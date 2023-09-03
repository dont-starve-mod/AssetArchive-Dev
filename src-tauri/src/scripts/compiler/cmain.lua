-- main for compiling entry

local function convert(s)
	return s:gsub("\\n", "\n"):gsub("\\r", "\r"):gsub("\\\"", "\""):gsub("\\\\", "\\")
end

local PO = Class(function(self, root)
	local f = root:Open("scripts/languages/chinese_s.po")
	assert(f, "Failed to open file: chinese_s.po")
	f:seek_to_string("#") -- skip file head
	local content = f:read_to_end()
	local strings = {}
	local key, value
	for line in content:gmatch("[^\n]+") do
		key = line:match("^msgctxt%s*%\"(%S*)%\"") or key
		value = line:match("^msgstr%s*%\"(.*)%\"") or value
		if value and key then
			strings[key] = convert(value)
			key = nil
			value = nil
		end
	end

	self.strings = strings
end)

function PO:__call(key)
	return self.strings[key]
end

function PO:GetName(name)
	return self("STRINGS.NAMES."..name:upper())
end

function PO:GetQuote(name)
	return self("STRINGS.CHARACTER_QUOTES."..name:lower())
end

function PO:GetSkinName(name)
	return self("STRINGS.SKIN_NAMES."..name:lower())
end

function PO:GetSkinQuote(name)
	return self("STRINGS.SKIN_QUOTES."..name:lower())
end

--- EntryManager
local EntryManager = Class(function(self)
	self.items = {} -- key -> Entry
	self.alias_map = {} -- alias -> key
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


function EntryManager:BuildBasic()
	local po = self.po
	local GetAlias2 = require("compiler/predefs").GetAlias2
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
		local assets = self:ResolveAssets(v.assets)
		-- {"assets":[{"file":"anim/player_ghost_withhat.zip","type":"ANIM"},
		-- {"file":"anim/ghost_abigail_build.zip","type":"ANIM"},
		-- {"file":"anim/ghost_abigail.zip","type":"ANIM"},
		-- {"file":"sound/ghost.fsb","type":"SOUND"}],
		-- "source":"abigail.lua","deps":["abigail_attack_fx","abigail_attack_fx_ground",
		-- "abigail_retaliation","abigailforcefield","abigaillevelupfx","abigail_vex_debuff",
		-- "abigail_formal","abigail_handmedown","abigail_lunar","abigail_nature","abigail_rose",
		-- "abigail_shadow","abigail_survivor"],"force_path_search":false,"name":"abigail","desc":""}
		
		self:AddEntry(Entry{
			assets = assets,
			source = { source },
			alias = GetAlias(prefab),
		}, {is_new = true, prefab = prefab})
	end
end

function EntryManager:ValidateAlias(alias)
	local key = self.alias_map[alias]
	if key ~= nil then
		assert(self.items[key], "Key not exists: "..key)
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
	-- opts.is_new       Specify a new entry explicitly
	local is_new = opts and opts.is_new
	-- opts.prefab       Entry point to a prefab
	local prefab = opts and opts.prefab

	-- map all aliases to keys
	local keys = {}
	local new_alias = {}
	for _, alias in ipairs(entry.alias)do
		if type(alias) == "string" and #alias > 0 then
			local key = self:ValidateAlias(alias)
			if key ~= nil then
				keys[key] = true
			else
				new_alias[alias] = true
			end
		end
	end

	-- check uniqueness of entry key 
	local n = GetTableSize(keys)
	local key = nil
	if n > 1 then
		print_error("Entry aliases point to multiple keys: ")
		for _, alias in ipairs(entry.alias)do
			print_error(string.format("* %s -> %s", alias, tostring(self:ValidateAlias(alias))))
		end
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
			print_info("New key: "..key)
		end

		return entry
	else
		if is_new then
			local skip_warning = false
			if prefab ~= nil then
				local prev = self.items[key]
				if IsOverlapping(prev.source, entry.source) then
					print_debug("Auto merge: source overlapping: "..prev.key.." - "..prefab)
					skip_warning = true
				elseif table.contains(prev.deps, prefab) or table.contains(entry.deps, key) then
					print_debug("Auto merge: deps linked: "..prev.key.." - "..prefab)
					skip_warning = true
				elseif prev.key:startswith(prefab) or prefab:startswith(prev.key) then
					print_debug("Auto merge: prefix: ", prev.key, prefab)
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
end

function EntryManager:AddKey(new_alias)
	local key = nil
	for k in pairs(new_alias)do
		if #k > 0 and k:lower() == k then
			local ascii = true
			for i = 1, #k do
				if string.byte(k, i) >= 128 then
					ascii = false
					break
				end
			end
			if ascii then
				key = k
				break
			end
		end
	end

	if key == nil then
		error("Failed to get key from aliases: "..json.encode(new_alias))
	end

	for k in pairs(new_alias)do
		if self.alias_map[k] ~= nil then
			error("Alias overrided: "..k.." -> "..self.alias_map[k])
		else
			self.alias_map[k] = key
		end
	end

	return key
end

local function main(GLOBAL)
	print_info("[Compiler] generator.main()")

	local success, prefabdata = pcall(json.decode, FileSystem.GetString("prefab.dat"))
	assert(success, "Failed to load prefab.dat")

	GLOBAL.po = PO(GLOBAL.root)
	local manager = EntryManager()
	manager.po = GLOBAL.po
	manager.root = GLOBAL.root
	manager.prov = GLOBAL.prov
	manager.prefabdata = prefabdata

	manager:BuildBasic()
end

return {
	main = main
}
