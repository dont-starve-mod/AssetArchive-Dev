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

function EntryManager:AddTagFromScrapbook()
	local data = self.root:LoadScript("screens/redux/scrapbookdata")

	local preparedfood = self.root:GetScript("preparedfoods")
	local preparedfood2 = self.root:GetScript("preparedfoods_warly")
	local foodnames = {}
	for _, content in ipairs{preparedfood, preparedfood2}do
		for key in content:sub(#"local foods ="):gmatch("([^\n%s]+) =%s*\n%s*{")do
			foodnames[key] = true
		end
	end
	table.foreach(foodnames, print)

	local all_tags = { fueled = 0, fuel = 0 }
	local other_keys = {}

	-- [base]
	-- name, prefab, tex, deps, type

	-- [preview]
	-- bank, build, anim, animpercent, facing, alpha[?]
	-- overridebuild, overridesymbol, hidesymbol, hide

	-- [tag]
	-- toolactions    -> tool
	-- float_range | float_accuracy | lure_charm | lure_dist | lure_radius -> fishing
	-- craftingprefab -> crafted_by.{player}
	-- workable       -> workable.{type}
	-- subcat         -> subcat.{type}
	-- insulator_type -> insulator.{type}
	-- foodtype       -> food.{type}
	-- fueltype       -> fuel.{type}
	-- * fuelvalue  -> [check tag above]
	-- fueledtype1 | fueledtype2 -> fueled_by.{type}
	-- * fueledrate | fueledmax  -> [check tag above]
	-- armor | absorb_percent -> armor
	-- armor_planardefense
	-- planardamage
	-- stewer
	-- finiteuses
	-- weaponrange > 5 -> ranged
	-- perishable
	-- stacksize      -> stackable
	-- sanityaura
	-- waterproofer   -> waterproofer | waterproofer_100
	-- burnable
	-- fishable
	-- lightbattery
	-- notes.shadow_aligned | .lunar_aligned -> shadow_align | lunar_aligned
	-- picakble       -> pickable
	-- weapondamage   -> weapon | weapon_0_damage
	-- sewable [clothes]
	
	-- [value-tag] +v -v
	-- healthvalue  -+
	-- sanityvalue  -|-- edible
	-- hungervalue  -+
	-- dapperness

	-- [ignore]
	-- speechname
	-- health
	-- areadamage
	-- damage
	-- fueleduses
	-- specialinfo
	-- harvestable
	-- activatable
	-- oar_velocity
	-- oar_force
	-- repairitems
	-- forgerepairable
	
	local BASE_KEYS = {
		"name", "prefab", "tex", "deps",
	}

	local PREVIEW_KEYS = {
		"bank", "build", "anim", "animpercent", "facing", "alpha",
		"overridebuild", "overridesymbol", "hidesymbol", "hide",
	}

	local SKIPPED_KEYS = {
		"speechname", "health", "areadamage", "damage", "fueleduses", 
		"specialinfo", "harvestable", "activatable", "stewer", 
		"oar_velocity", "oar_force", "repairitems", "forgerepairable",
		"animoffsetx", "animoffsety", "animoffsetbgx", "animoffsetbgy", "scale",

	}

	local TAGS = {
		float_range = "fishing",
		float_accuracy = "fishing",
		lure_charm = "fishing",
		lure_dist = "fishing",
		lure_radius = "fishing",

		type = "type.{}",
		craftingprefab = "crafted_by.{}",
		workable = "workable.{}",
		subcat = "subcat.{}",
		insulator_type = "insulator.{}",
		foodtype = "food.{}",
		fueltype = "fuel.{}",
		fueledtype1 = "fueled_by.{}",
		fueledtype2 = "fueled_by.{}",

		armor = "armor",
		absorb_percent = "armor",

		armor_planardefense = true,
		planardamage = true,
		finiteuses = true,
		sanityaura = true,
		burnable = true,
		fishable = true,
		perishable = true,
		lightbattery = true,
		sewable = true,
		stewer = true,
		toolactions = "tool",
		stacksize = "stackable",
		picakble = "pickable",

		["weapondamage"] = function(tags, v)
			assert(type(v) == "string" or v >= 0, v)
			tags["weapon"] = true
			tags["weapon_0_damage"] = v == 0
		end,
		["dapperness"] = function(tags, v)
			assert(v ~= 0)
			tags[v > 0 and "dapperness+" or "dapperness-"] = true
		end,
		["notes"] = function(tags, v)
			assert(type(v) == "table")
			tags["shadow_aligned"] = v.shadow_aligned
			tags["lunar_aligned"] = v.lunar_aligned
		end,
		["waterproofer"] = function(tags, v)
			assert(v > 0)
			tags["waterproofer"] = true
			tags["waterproofer_100"] = v >= 1
		end,
		["healthvalue"] = function(tags, v)
			if v ~= 0 then
				tags[v > 0 and "healthvalue+" or "healthvalue-"] = true
			end
		end,
		["sanityvalue"] = function(tags, v)
			if v ~= 0 then
				tags[v > 0 and "sanityvalue+" or "sanityvalue-"] = true
			end
		end,
		["hungervalue"] = function(tags, v)
			if v ~= 0 then
				tags[v > 0 and "hungervalue+" or "hungervalue-"] = true
			end
		end,
		["weaponrange"] = function(tags, v)
			assert(v > 0)
			if v > 5 then
				tags["rangedweapon"] = true
			end
		end,
	}

	local function TagsInclude(tags, fn)
		for t in pairs(tags)do
			if fn(t) then
				return true
			end
		end
	end

	local CHECK_TAGS = {
		insulator = function(tags)
			return TagsInclude(tags, function(t) return t:startswith("insulator_type.") end)
		end,
		fuelvalue = function(tags)
			return TagsInclude(tags, function(t) return t:startswith("fuel.") end)
		end,
		fueledrate = function(tags)
			return TagsInclude(tags, function(t) return t:startswith("fueled_by.") end)
		end,
	}

	CHECK_TAGS.fueledmax = CHECK_TAGS.fueledrate

	local item_list = {}
	table.foreach(data, function(_, v)
		local item = {}
		local preview_data = {}
		for _, k in ipairs(BASE_KEYS)do
			item[k] = v[k]
			v[k] = nil
		end
		for _, k in ipairs(PREVIEW_KEYS)do
			preview_data[k] = v[k]
			v[k] = nil
		end

		if preview_data.overridesymbol then
			if type(preview_data.overridesymbol[1]) ~= "table" then
				preview_data.overridesymbol = { preview_data.overridesymbol }
			end
		end

		local tags = {}
		for tag_name, tag_def in pairs(TAGS)do
			if v[tag_name] ~= nil then
				if tag_def == true then
					tags[tag_name] = true
				elseif type(tag_def) == "string" then
					if tag_def:find("{}") then -- template string
						tags[tag_def:gsub("{}", string.lower(v[tag_name]))] = true
					else
						tags[tag_def] = true
					end
				elseif type(tag_def) == "function" then
					tag_def(tags, v[tag_name])
				end

				v[tag_name] = nil
			end
		end

		for tag_name, checker in pairs(CHECK_TAGS)do
			if tags[tag_name] and not checker(tags) then
				print("Warning: check failed")
				print(json.encode(tags))
			end
			v[tag_name] = nil
		end

		if foodnames[item.prefab] then
			tags["preparedfood"] = true
		end

		item.preview_data = {tex = v.tex, anim = preview_data}
		item.tags = tags
		table.insert(item_list, item)

		for k in pairs(tags)do
			if k:startswith("fueled_by") then
				if v["fueleduses"] then
					tags["finiteuses"] = true
				else
					tags["fueled"] = true
				end
			end
			all_tags[k] = (all_tags[k] or 0) + 1
		end
		
		for _, k in ipairs(SKIPPED_KEYS)do
			v[k] = nil
		end
		for k in pairs(v)do
			other_keys[k] = true
		end
	end)
	
	if next(other_keys) then
		print("Unexpected scrapbook data keys: ")
		table.foreach(other_keys, function(k) print("  "..k) end)
		exit()
	end

	self.anim_preview_list = {}
	for _,v in ipairs(item_list)do
		self.anim_preview_list[v.prefab] = v.preview_data.anim
	end

	print(#item_list.." Scrapbook entries: ")

	for _,v in ipairs(item_list)do
		if self.items[v.prefab] ~= nil then
			self.items[v.prefab].preview_data = assert(v.preview_data)
			self.items[v.prefab].tags = assert(v.tags)
		elseif self.alias_map[v.prefab] ~= nil then
			local key = self.alias_map[v.prefab]
			self.items[key].preview_data = assert(v.preview_data)
			self.items[key].tags = assert(v.tags)
		else
			print("Entry not found: ", v.prefab)
		end
	end

	if false then
		-- sort by occurence
		local temp = {}
		table.foreach(all_tags, function(k, count)
			table.insert(temp, {k, count})
		end)
		table.sort(temp, function(a, b) return a[2] > b[2] end)
		table.foreach(temp, function(_, v) print(unpack(v))end)
	end

	local all_tags = ToArray(all_tags)
	local all_tags_names = {}
	table.sort(all_tags)
	local GetTagName = require "compiler/entrydesc/tag".GetTagName
	table.foreach(all_tags, function(_,k) 
		local name = GetTagName(self.po, k)
		if name == nil then
			error("Failed to get tag name: "..k)
		elseif name ~= "#REMOVE" then
			table.insert(all_tags_names, {k, name})
		end
	end)
	print(#all_tags_names.." Tags: ")
	
	self.all_tags_names = all_tags_names
end

function EntryManager:AddTagFromFx()
	local fx = self.root:LoadScript("fx", 
		{Vector3 = function() end, STRINGS = DUMMY_FIELD, table = table, tostring = tostring})
	for k,v in pairs(fx)do
		local name = assert(v.name)
		local bank = assert(v.bank)
		local anim = assert(v.anim)
		local build = assert(v.build)
		local sound = v.sound
		assert(type(sound) == "nil" or type(sound) == "string")
		if type(anim) == "function" then
			setfenv(anim, {math = math})
			anim = anim()
			local _, _, name, num = anim:find("(.*)(%d)")
			assert(name) 
			assert(tonumber(num) ~= nil)
			anim = name.."1"
		end
		local preview_data = {
			anim = {
				bank = bank,
				anim = anim,
				build = build,
				is_fx = true,
			},
			sound = sound,
		}
		local entry = assert(self.items[name], name)
		assert(entry.preview_data.anim == nil, name)
		entry.preview_data = preview_data
		entry.tags["#fx"] = true
	end
end

function EntryManager:AddDSTMainScreen()
	-- screens/redux/multiplayermainscreen
	for k,v in pairs{
		waterlogged = true,
		yot_catcoon = true,
		moonstorm_background = {anim_list = {"loop_w1", "loop_w2", "loop_w3"}},
		moonstorm_foreground = {anim_list = {"loop_w1", "loop_w2", "loop_w3"}},
		-- moonstorm_wrench = {anim = "loop_w1"},
		carrat_bg = {bank = "dst_carrat_bg"},
		carrat = {bank = "dst_carrat", presets = (function() 
			local result = {
				{key = "normal", cmds = {}},
			}
			local colors ={
				"blue",
				"brown",
				"pink",
				"purple",
				"yellow",
				"green",
				"white",
			}
			for _,c in ipairs(colors)do
				table.insert(result, {key = c, cmds = {
					{name = "OverrideSymbol", args = {"ear1", "dst_carrat_swaps", c.."_ear1"}},
					{name = "OverrideSymbol", args = {"ear2", "dst_carrat_swaps", c.."_ear2"}},
					{name = "OverrideSymbol", args = {"tail", "dst_carrat_swaps", c.."_tail"}},
				}})
			end
			return result 
		end)()},
		yotr = true,
		halloween2 = true,
		carnival = true,
		webber_carnival = {bank = "dst_menu_webber", build = "dst_menu_webber_carnival"},
		wes = true,
		wes2 = true,
		wendy = true,
		webber = true,
		wanda = {anim_list = {"loop_1", "loop_2", "loop_3"}},
		terraria = true,
		wolfgang = {presets = {
			{key = "wimpy", cmds = {{name = "Hide", args = {"mid"}}, {name = "Hide", args = "mighty"}}},
			{key = "mid", cmds = {{name = "Hide", args = {"wimpy"}}, {name = "Hide", args = "mighty"}}},
			{key = "mighty", cmds = {{name = "Hide", args = {"wimpy"}}, {name = "Hide", args = "mid"}}},
		}},
		wx78 = {bank = "dst_menu_wx", build = "dst_menu_wx"},
		wickerbottom = true,
		pirates = true,
		drama_bg = {bank = "dst_menu_charlie2", build = "dst_menu_charlie2", anim = "loop_bg"},
		charlie_halloween = true,
		charlie = true,
		waxwell = true,
		wilson = true,
		lunarrifts = true,
		rift2 = true,
		meta2 = {bank = "dst_menu_meta2", build = "dst_menu_meta2_cotl"},
		rift3_BG = {presets = {
			{key = "normal", cmds = {{name = "Hide", args = "HOLLOW"}}},
			{key = "hollow", cmds = {}},
		}}, 
		rift3 = {presets = {
			{key = "normal", cmds = {{name = "Hide", args = "HOLLOW"}}},
			{key = "hollow", cmds = {}},
		}},
		meta3 = true,
		menu_v2_bg = true,
		menu_v2 = true,
	}do
		local data = {bank = "dst_menu_"..k, build = "dst_menu_"..k, anim = "loop"}
		if type(v) == "table" then
			-- convert to presets
			if v.anim_list then
				local presets = {}
				for _, name in ipairs(v.anim_list)do
					table.insert(presets, {key = name, cmds = {{name = "PlayAnimation", args = {name}}}})
				end
				data.presets = presets
			end
			-- override default values
			for kk, vv in pairs(v)do
				data[kk] = vv
			end
		end
	end
end


local function run(env)
	local manager = EntryManager()

	manager.po = env.po
	manager.root = env.root
	manager.prov = env.prov
	manager.prefabdata = env.prefabdata

	manager:BuildPredefs()
	manager:BuildPrefabs()
	manager:AddTagFromScrapbook()
	manager:AddTagFromFx()

	local output = FileSystem.Path(SCRIPT_ROOT)/"compiler"/"output/"
	local path = output/"entry.dat"
	local str = json.encode({
		items = manager.items,
		alias_map = manager.alias_map,
	})
	-- it's only for debug, will always failed in release
	pcall(function() path:write(str) end)
	FileSystem.SaveString("entry.dat", str)

	-- write anim preview list
	env.write_json("anim_preview_list", manager.anim_preview_list)

	-- write tags
	env.write_json("entry_tags", manager.all_tags_names)
end

return run
