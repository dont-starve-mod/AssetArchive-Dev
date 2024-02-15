local PREDEF = require "compiler.entrydesc.predef"

local EntryManager = Class(function(self)
	self.items = {} -- {key: Entry}
	self.alias_map = {} -- {alias: key}
end)

function EntryManager:ResolveAssets(list)
	local provider = self.prov
	local result = {}
	for _, v in ipairs(list)do
		local type, file = v.type, v.file
		local asset = Asset.FromGame(type, file)
		if asset ~= nil then
			if type == "INV_IMAGE" then
				local xml, name = provider:ResolveInvImage(file)
				asset.type = "tex"
				asset.xml = xml
				asset.tex = name
			elseif type == "MINIMAP_IMAGE" then
				local xml, name = provider:ResolveMinimapImage(file)
				asset.type = "tex"
				asset.xml = xml
				asset.tex = name
			end
			table.insert(result, asset)
		end
	end
	table.foreach(result, function(_, v) v:GetID() end) -- check all assets have been resolved
	return result
end

function EntryManager:BuildPredefs()
	print_info("[EntryManager] BuildPredefs")
	local PREDEF_ALIAS_GROUP = PREDEF.PREDEF_ALIAS_GROUP
	for _, group in pairs(PREDEF_ALIAS_GROUP)do
		self:AddEntry(Entry{
			alias = group,
		}, {is_new = true, is_predef = true})
	end
end

function EntryManager:BuildPrefabs()
	print_info("[EntryManager] BuildPrefabs")
	local po = self.po
	local GetAlias2 = PREDEF.GetAlias2
	local function GetAlias(key)
		local custom = GetAlias2(key, po)
		if custom ~= nil then
			table.insert(custom, key)
			return custom
		else
			return { key, po:GetName(key), po:GetSkinName(key) }
		end
	end

	for _,v in pairs(self.prefabdata.prefabs)do
		local prefab = v.name
		local source = v.source
		local deps = v.deps
		local assets = self:ResolveAssets(v.assets)
		
		self:AddEntry(Entry{
			assets = assets,
			source = { source },
			alias = GetAlias(prefab),
		}, {is_new = true, prefab = prefab})
	end
end 

function EntryManager:AliasToKey(alias)
	local key = self.alias_map[alias]
	if key ~= nil then
		assert(self.items[key] ~= nil, "Key not exists: "..key)
		assert(self.alias_map[key] == key, "Key not valid: "..key)
		return key
	end
end

local function IsOverlapping(s1, s2)
	local map = ToIndexTable(s1)
	for _,v in ipairs(s2)do
		if map[v] then
			return true
		end
	end
end

function EntryManager:AddEntry(entry, opts)
	opts = opts or {}
	local is_new = opts.is_new -- specify a new entry explicitly
	local prefab = opts and opts.prefab -- prefab name that the entry related to

	-- map all aliases to keys
	local keys = {}
	local new_alias = {}
	for _, alias in ipairs(entry.alias)do
		if type(alias) == "string" and #alias > 0 then
			local key = self:AliasToKey(alias)
			if key ~= nil then
				keys[key] = true
			else
				table.insert(new_alias, alias)
			end
		end
	end

	-- check uniqueness of entry key 
	local n = GetTableSize(keys)
	local key = nil
	if n > 1 then
		print_error("Entry aliases point to multiple keys: ")
		for _, alias in ipairs(entry.alias)do
			print_error(string.format("* %s -> %s", alias, tostring(self:AliasToKey(alias))))
		end
		-- entry key must be unique, and alias in different entries must be different
		-- key1 => alias1, alias2
		-- key2 => alias3, alias4
		-- key3 => alias1 (x) conflict with key1
		error("runtime error")
	elseif n == 1 then
		key = next(keys)
	end

	if key == nil then
		key = self:AddKey(new_alias)
		entry:SetKey(key)
		self.items[key] = entry

		if not is_new then
			-- give a message if `is_new` is not set explicitly
			print_info("generate a new key implicitly: "..key)
		end

		if opts.is_predef then
			entry.is_predef = true
		end

		return entry
	else
		if is_new then
			local skip_warning = false
			if prefab ~= nil then
				local prev = self.items[key]
				if prev.is_predef then
					print_debug("Auto merge: predef: "..prev.key.." - "..prefab)
					skip_warning = true 
				elseif IsOverlapping(prev.source, entry.source) then
					print_debug("Auto merge: source overlapping: "..prev.key.." - "..prefab)
					skip_warning = true
				elseif table.contains(prev.deps, prefab) or table.contains(entry.deps, key) then
					print_debug("Auto merge: deps linked: "..prev.key.." - "..prefab)
					skip_warning = true
				elseif prev.key:startswith(prefab) or prefab:startswith(prev.key) then
					print_debug("Auto merge: prefix: ", prev.key, prefab)
					skip_warning = true
				elseif (prev.key:endswith(prefab) or prefab:endswith(prev.key))
					and (prev.key:startswith("dug_") or prefab:startswith("dug_")
					  or prev.key:startswith("weed_") or prefab:startswith("weed_")) then
					print_debug("Auto merge: postfix: ", prev.key, prefab)
					skip_warning = true
				else
					-- 检查predef组关系
				end
			end

			if skip_warning == false then
				print("Warning: entry already exists, but defined as new")
				print("  Key = ".. key)
				print("  Alias = "..json.encode(entry.alias))
			end
		end
	end
	return entry
end

function EntryManager:AddKey(new_alias)
	local key = nil
	for _, v in pairs(new_alias)do
		if #v > 0 and v:lower() == v then
			if v:match("[a-zA-Z0-9%_%-]+") then
				key = v
				break
			end
		end
	end

	if key == nil then
		error("Failed to get key from aliases: "..json.encode(new_alias))
	end

	for _, v in pairs(new_alias)do
		if self.alias_map[v] ~= nil then
			error("Alias overrided: "..v.." -> "..self.alias_map[v])
		else
			self.alias_map[v] = key
		end
	end

	return key
end

local function run(env)
	local manager = EntryManager()

	manager.po = env.po
	manager.root = env.root
	manager.prov = env.prov
	manager.prefabdata = env.prefabdata

	manager:BuildPredefs()
	manager:BuildPrefabs()


	local output = FileSystem.Path(SCRIPT_ROOT)/"compiler/output/"
	local path = output/"entry.dat"
	local str = json.encode({
		items = manager.items,
		alias_map = manager.alias_map,
	})
	-- it's only for debug, will always failed in release
	pcall(function() path:write(str) end)
	FileSystem.SaveString("entry.dat", str)
end

return run
