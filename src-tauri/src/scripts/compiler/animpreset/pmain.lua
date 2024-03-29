-- generate animation preset for static using

local smallhash = Algorithm.SmallHash_Impl

local AnimPresetGen = {
	prefabdata = nil,
	provider = nil,
}

local Preset = Class(function(self, data)
	self.key = data.key
	self.title = data.title
	self.cmds = data.cmds
	self.icon = data.icon
end)

local ALL_PRESETLIST = {}

local CONDITION = {
	IS_PLAYER = { "BankIs", "wilson", "wilsonbeefalo", "wilson_sit", "wilson_sit_nofaced" },
}

ALL_PRESETLIST.character_base = {
	title = "角色外观",
	condition = CONDITION.IS_PLAYER,
	presets = {
		Preset{ key = "wilson" },
		Preset{ key = "wendy" },
		Preset{ key = "wx78" },
		Preset{ key = "wickerbottom" },
		Preset{ key = "willow" },
		Preset{ key = "wonkey" },
		
		Preset{ key = "wolfgang" },
		Preset{ key = "woodie" },
		Preset{ key = "wes" },
		Preset{ key = "waxwell" },
		Preset{ key = "wathgrithr" },
		Preset{ key = "webber" },
		Preset{ key = "winona" },
		Preset{ key = "warly" },
		Preset{ key = "wortox" },
		Preset{ key = "wormwood" },
		Preset{ key = "wurt" },
		Preset{ key = "walter" },
		Preset{ key = "wanda" },
	},
	presets_configable = true,
}

table.foreach(ALL_PRESETLIST.character_base.presets, function(_, v)
	v.title = function(po) return po:GetName(v.key) end
	v.cmds = {{name = "SetBuild", args = {v.key}}}
	v.icon = "swap_icon"
end)

ALL_PRESETLIST.equip_hand = {
	title = "工具/武器",
	order = 10,
	condition = CONDITION.IS_PLAYER,
	presets = {
		Preset{
			key = nil,
			icon = "TODO",
			cmds = {
				{name = "Hide", args = {"arm_carry"}},
			}
		},
		{
			key = "spear",
			cmds = {
				{name = "Hide", args = {"arm_normal"}},
				{name = "OverrideSymbol", args = {"swap_object", "swap_spear", "swap_spear"}},
			}
		},
		{
			key = "hambat",
			cmds = {
				{name = "Hide", args = {"arm_normal"}},
				{name = "OverrideSymbol", args = {"swap_object", "swap_ham_bat", "swap_ham_bat"}},
			}
		},
		{
			key = "ruins_bat",
			cmds = {
				{name = "Hide", args = {"arm_normal"}},
				{name = "OverrideSymbol", args = {"swap_object", "swap_ruins_bat", "swap_ruins_bat"}},
			}
		},
		{
			key = "cane",
			cmds = {
				{name = "Hide", args = {"arm_normal"}},
				{name = "OverrideSymbol", args = {"swap_object", "swap_cane", "swap_cane"}},
			}
		},
		{
			key = "axe",
			cmds = {
				{name = "Hide", args = {"arm_normal"}},
				{name = "OverrideSymbol", args = {"swap_object", "swap_axe", "swap_axe"}},
			}
		},
		{
			key = "axe_invisible",
			cmds = {
				{name = "Hide", args = {"arm_normal"}}
			}
		},
	}
}

local function CreateHat(name, opentop)
	local layers = opentop and {
		"hair_hat", "head_hat", "head_hat_nohelm", "head_hat_helm",
	} or {
		"hair_nohat", "hair", "head", "head_hat_helm",
	}
	local hidecmds = {}
	for _,v in ipairs(layers)do
		table.insert(hidecmds, 
			{ name = "Hide", args = {v}} )
	end
	return Preset{
		key = name.."hat",
		icon = "inv",
		cmds = {
			{name = "OverrideSymbol", args = {"swap_hat", "hat_"..name, "swap_hat"}},
			unpack(hidecmds)
		}
	}
end

ALL_PRESETLIST.equip_head = {
	title = "帽子/头盔",
	order = 11,
	condition = CONDITION.IS_PLAYER,
	presets = {
		Preset{
			key = nil,
			icon = "TODO:",
			cmds = {
				{name = "Hide", args = {"hat"}},
				{name = "Hide", args = {"hair_hat"}},
				{name = "Hide", args = {"head_hat"}},
			},
		},
		CreateHat("straw"),
		CreateHat("beefalo"),
		CreateHat("top"),
		CreateHat("football"),
		CreateHat("ruins", true),
		CreateHat("flower", true),
		CreateHat("mask_doll"),
	}
}

ALL_PRESETLIST.equip_head_pig = json.decode(json.encode(ALL_PRESETLIST.equip_head))
ALL_PRESETLIST.equip_head_pig.condition = {"BankIs", "pigman"}
table.foreach(ALL_PRESETLIST.equip_head_pig.presets, function(_, p)
	for i = #p.cmds, 1, -1 do
		-- hide head layer only work on player, remove it from pig
		if p.cmds[i].args[1] == "head" then
			table.remove(p.cmds, i)
			break
		end
	end
end)

ALL_PRESETLIST.pig_token = {
	title = "金腰带",
	condition = {"BankIs", "pigman"},
	presets = {
		Preset{
			key = nil
		},
		Preset{
			key = "pig_token",
			cmds = {{name = "OverrideSymbol", args = {"pig_belt", "pig_token", "pig_belt"}}},
		},
	}
}

ALL_PRESETLIST.equip_body = {
	title = "背包/护甲",
	order = 12,
	condition = CONDITION.IS_PLAYER,
	presets = {
		Preset{
			key = nil,
			icon = {xml = "INV", tex = "xxxx.tex"} -- TODO:
		},
		Preset{
			key = "backpack",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body", "swap_backpack", "swap_body"}},
				{name = "OverrideSymbol", args = {"backpack", "swap_backpack", "backpack"}},
			},
		},
		Preset{
			key = "krampus_sack",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body", "swap_krampus_sack", "swap_body"}},
				{name = "OverrideSymbol", args = {"backpack", "swap_krampus_sack", "backpack"}},
			}
		},
		Preset{
			key = "armorwood",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body", "armor_wood", "swap_body"}},
			}
		},
		Preset{
			key = "armorruins",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body", "armor_ruins", "swap_body"}},
			}
		},
		Preset{
			key = "amulet",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body", "torso_amulets", "redamulet"}},
			}
		},
		Preset{
			key = "onemanband",
			cmds = {
				{name = "OverrideSymbol", args = {"swap_body_tall", "armor_onemanband", "swap_body_tall"}},
			}
		},
	}
}

ALL_PRESETLIST.mount = {
	title = "坐骑",
	order = 13,
	condition = { "BankIs", "wilsonbeefalo" },
	presets = {
		Preset{
			key = nil,
		},
		Preset{
			key = "beefalo",
			cmds = {
				{name = "AddOverrideBuild", args = {"beefalo_build"}}
			}
		},
		Preset{
			key = "wobybig",
			cmds = {
				{name = "AddOverrideBuild", args = {"woby_big_build"}}
			}
		}
	}
}

ALL_PRESETLIST.saddle = {
	title = "鞍",
	order = 14,
	condition = { "BankIs", "wilsonbeefalo" },
	presets = {
		Preset{
			key = nil,
		},
		Preset{
			key = "saddle_basic",
		},
		Preset{
			key = "saddle_war",
		},
		Preset{
			key = "saddle_race",
		},
		Preset{
			key = "saddle_wathgrithr",
		},
	},
}

table.foreach(ALL_PRESETLIST.saddle.presets, function(_, v)
	v.cmds = {
		{name = "OverrideSymbol", args = {"swap_saddle", v.key, "swap_saddle"}}
	}
end)

-- see prefabs/pigelitefighter.lua
local ELITE_BUILD_VARIATIONS =
{
    ["1"] = { "pig_ear", "pig_head", "pig_skirt", "pig_torso", "spin_bod" },
    ["2"] = { "pig_arm", "pig_ear", "pig_head", "pig_skirt", "pig_torso", "spin_bod" },
    ["3"] = { "pig_arm", "pig_ear", "pig_head", "pig_skirt", "pig_torso", "spin_bod" },
    ["4"] = { "pig_head", "pig_skirt", "pig_torso", "spin_bod" },
}

ALL_PRESETLIST.pig_elite = {
	title = "猪人精英战士",
	condition = { "BankIs", "pigman" },
	presets = {
		Preset{
			key = nil,
		},
	}
}

table.foreach(ELITE_BUILD_VARIATIONS, function(k, symbols)
	local cmds = {}
	table.insert(ALL_PRESETLIST.pig_elite.presets, Preset{
		key = "pigelitefighter"..k,
		cmds = cmds,
	})
	for _,v in ipairs(symbols)do
		table.insert(cmds, {name = "OverrideSymbol", args = {
			v, "pig_elite_build", v.."_"..k,
		}})
	end
end)

ALL_PRESETLIST.ghost_base = {
	title = "鬼魂外观",
	condition = { "BankIs", "ghost" },
	presets = {
		Preset{
			key = "wilson",
			cmds = {{name = "SetBuild", args = {"ghost_wilson_build"}}},
		},
		Preset{
			key = "wendy",
			cmds = {{name = "SetBuild", args = {"ghost_wendy_build"}}},
		},
		Preset{
			key = "wx78",
			cmds = {{name = "SetBuild", args = {"ghost_wx78_build"}}},
		},
		Preset{
			key = "ghost",
			cmds = {{name = "SetBuild", args = {"ghost_build"}}},
		},
		Preset{
			key = "abigail",
			cmds = {{name = "SetBuild", args = {"ghost_abigail_build"}}},
		},
	}
}

-- Hides (ref to scrapbook data)
ALL_PRESETLIST.deerclops = {
	title = "head_neutral",
	condition = { "BankIs", "deerclops" },
	presets = {
		Preset{
			key = "hide", cmds = {{name = "Hide", args = {"head_neutral"}}},
		},
		Preset{
			key = "show", cmds = {}
		},
	},
}

ALL_PRESETLIST.tallbird = {
	title = "beakfull",
	condition = { "BankIs", "tallbird" },
	presets = {
		Preset{
			key = "hide", cmds = {{name = "Hide", args = {"beakfull"}}},
		},
		Preset{
			key = "show", cmds = {}
		},
	},
}

ALL_PRESETLIST.manrabbit_swap = {
	title = "manrabbit_swap",
	condition = { "BankIs", "manrabbit" },
	presets = {
		Preset{
			key = "hide", cmds = {{name = "Hide", args = {"ARM_carry"}}},
		},
		Preset{
			key = "show", cmds = {}
		},
	},
}

ALL_PRESETLIST.manrabbit_hat = {
	title = "manrabbit_hat",
	condition = { "BankIs", "manrabbit" },
	presets = {
		Preset{
			key = "hide", cmds = {
				{name = "Hide", args = {"hat"}},
				{name = "Hide", args = {"HAIR_HAT"}}
			},
		},
		Preset{
			key = "show", cmds = {}
		},
	},
}

ALL_PRESETLIST.krampus = {
	title = "krampus_arm",
	condition = { "BankIs", "krampus" },
	presets = {
		Preset{
			key = "hide", cmds = {{name = "Hide", args = {"ARM"}}},
		},
		Preset{
			key = "show", cmds = {}
		},
	},
}

ALL_PRESETLIST.mosquito_body = {
	title = "mosquito_body",
	condition = { "BankIs", "mosquito" },
	presets = {}
}

for i = 1, 4 do
	local layer = "body_"..i
	local cmds = {}
	for j = 1, 4 do
		if j ~= i then
			table.insert(cmds, {name = "Hide", args = {"body_"..j}})
		end
	end
	ALL_PRESETLIST.mosquito_body.presets[i] = Preset {
		key = layer,
		cmds = cmds,
	}
end

ALL_PRESETLIST.terrarium = {
	title = "terrarium_tree_crimson",
	condition = { "BankIs", "terrarium" },
	presets = {
		Preset{
			key = "hide",
			cmds = {{name = "Hide", args = {"terrarium_tree_crimson"}}}
		},
		Preset{
			key = "show",
			cmds = {}
		}
	}
}

local function CheckPresets()
	table.foreach(ALL_PRESETLIST, function(k, v)
		v.key = k
		v.order = v.order or 0

		table.foreach(v.presets, function(_, p)
			if p.key == nil then
				p.key = "null"
				p.title = "无"
				p.cmds = p.cmds or {}
				for _,api in ipairs(p.cmds)do
					if type(api.args) ~= "table" then
						print("Warning: api args is string: "..api.args)
						api.args = { api.args }
					end
				end
			end
		end)

		table.foreach(v.presets, function(_, p)
			for _,cmd in ipairs(p.cmds)do
				assert(cmd.name ~= nil, p.key)
				assert(cmd.args ~= nil, p.key)
			end
		end)
	end)
end

local CreateReader = FileSystem.CreateReader

local function LinkBuildPresetForAnimation(env)
	local root = env.root
	local provider = env.prov
	local prefabdata = env.prefabdata
	local index = provider.index

	local skip_banks = {
		[smallhash("wilson")] = true,
		[smallhash("wilsonbeefalo")] = true,
		[smallhash("wilson_sit")] = true,
		[smallhash("wilson_sit_nofaced")] = true,
		-- [smallhash("pigman")] = true,
		[smallhash("ghost")] = true,

		-- unused
		[smallhash("forceexport/float_back")] = true,
		[smallhash("forceexport/float_front")] = true,
		[smallhash("forceexport/fx_bubble")] = true,
	}

	local anim_asset_groups = {} -- {[K: prefab]: Set<filename>}
	local anim_asset_prefab = {} -- {[K: filename]: Set<prefab>}
	for _,v in ipairs(prefabdata.prefabs)do
		local prefab = v.name
		local assets = v.assets
		if anim_asset_groups[prefab] == nil then
			anim_asset_groups[prefab] = {}
		end
		for _, a in ipairs(assets)do
			if a.type == "ANIM" then
				anim_asset_groups[prefab][a.file] = true
			end
		end
	end
	for k,v in pairs(anim_asset_groups)do
		for path in pairs(v)do
			if anim_asset_prefab[path] == nil then
				anim_asset_prefab[path] = {}
			end
			anim_asset_prefab[path][k] = true
		end
	end
	local function GetAllFiles(files)
		local result = {}
		for _, path in ipairs(files)do
			local prefab_set = anim_asset_prefab[path] or {}
			for prefab in pairs(prefab_set)do
				for path in pairs(anim_asset_groups[prefab])do
					result[path] = true
				end
			end
		end
		return result
	end

	local success = 0
	local failed = 0
	local result = {} -- {[bankhash]: build}
	table.foreach(index.animinfo, function(bankhash, data)
		if not skip_banks[bankhash] then
			local bankname = HashLib:Hash2String(bankhash) or tostring(bankhash)
			local files = {}
			for k,v in pairs(data)do
				for f in pairs(v.files)do
					files[f] = true
				end
			end
			files = ToArray(files)
			assert(#files > 0)
			if #files == 1 then
				-- check build existance
				local info = index:GetZipFileAbstract(files[1])
				if info.has_build then
					-- simple zip: anim.bin + build.bin + atlas-N.tex
					-- do nothing for preset
					print_debug("[PRESET] "..bankname.." ... "..NameOf(files[1]))
					success = success + 1
					result[bankhash] = {info.build}
					return
				else
					-- zip only contains anim.bin
				end
			end
			-- seperated anim & build
			local related_files = GetAllFiles(files)
			for k in pairs(related_files)do
				local data = index:GetZipFileAbstract(k)
				if data == nil then
					print_info("Failed to get abstract: ", k)
					related_files[k] = nil
				elseif not data.has_build then
					related_files[k] = nil
				end
			end
			local force_build = nil
			local sort_pref = nil
			local num = GetTableSize(related_files)
			local function FilterBy(fn)
				for k in pairs(related_files)do
					if not fn(k) then related_files[k] = nil end
				end
			end

			if bankname == "cook_pot" then
				FilterBy(function(k) return k:find("cook_pot") and not k:find("cook_pot_food") end)
			elseif bankname == "pumpkin" then
				FilterBy(function(k) return k:find("pumpkin") end)
			elseif bankname == "clock01" then
				FilterBy(function(k) return k:find("clock") end)
			elseif bankname == "chester"
				or bankname == "kitcoon"
				or bankname == "dumbbell_heat"
				or bankname == "deerclops" 
				or bankname == "bearger"
				or false
				or false then
				FilterBy(function(k) return k:startswith("anim/"..bankname) end)
			elseif bankname == "hound" then
				FilterBy(function(k) return not k:find("hound_basic") end)
			elseif bankname == "pigman" then
				FilterBy(function(k)
					return not k:find("pig_elite") -- as preset
						and not k:find("pig_token") -- as preset
						and not k:find("slide_puff")
						and not k:find("splash_water")
						and not k:find("yotb")
						and not k:find("quagmire_swampig_extras")
					end)
				sort_pref = "pig"
			elseif bankname == "crow" then
				force_build = {"crow_build", "robin_build", "robin_winter_build"}
			elseif bankname == "crow_kids" then
				force_build = {"crow_kids"}
			elseif bankname == "werebeaver" or bankname == "weregoose" or bankname == "weremoose" then
				force_build = {bankname.."_build"}
			elseif bankname == "dst_menu_webber" then
				force_build = {"dst_menu_webber", "dst_menu_webber_carnival"}
			elseif num <= 8
				or bankname == "oceanfish_small"
				or bankname == "oceanfish_medium"
				or bankname == "hound"
				or bankname == "beefalo"
				or bankname == "chesspiece"
				or bankname == "spider"
				or bankname == "wall" then
				-- add all build files to preset
			else
				-- TO MANY items!
				print("Warning: too many build files related to bank:")
				print(bankname, json.encode(related_files))
				failed = failed + 1
			end

			if GetTableSize(related_files) == 0 then
				if bankname:lower():startswith("cloudsfx_ol_") then
					force_build = {"cloud_build"}
				elseif bankname == "dst_menu_meta2" then
					force_build = {"dst_menu_meta2_cotl"}
				else
					print("Warning: no build files related: "..bankname)
				end
			end

			-- convert to build
			local builds = {}
			if force_build ~= nil then
				-- override
				for _,v in ipairs(force_build)do
					assert(index:GetBuildFile(v), "build file not found: "..v)
				end
				builds = force_build
			else
				for k in pairs(related_files)do
					local info = index:GetZipFileAbstract(k)
					local build = info and info.build
					if build ~= nil then
						table.insert(builds, build)
					end
				end
			end
			if #builds > 0 then
				-- print(table.concat(builds, ", "))
				table.sort(builds, function(a, b) 
					local ap = sort_pref ~= nil and a:find(sort_pref) ~= nil
					local bp = sort_pref ~= nil and b:find(sort_pref) ~= nil
					if ap == bp then
						return a < b
					else
						return ap
					end
				end)
				result[bankhash] = builds
			else
				error("Failed to link bankname: ", bankname)
			end
		end
	end)

	print("Success: "..success.." / Failed: "..failed)

	-- convert to json friendly
	local data = {}
	for k,v in pairs(result)do
		table.insert(data, {bankhash = k, build = v})
	end

	-- get dst_menu presets
	table.foreach(env.dst_menu_presets, function(_, v)
		local bank, presets = v.bank, v.presets
		assert(ALL_PRESETLIST[bank] == nil)
		ALL_PRESETLIST[bank] = {
			title = bank,
			condition = { "BankIs", bank },
			presets = presets,
		}
	end)

	CheckPresets()

	env.write_json("animpreset", {
		def = ALL_PRESETLIST,
		auto = data,
	})

	return result
end

local function run(env)
	local root = assert(env.root)
	local provider = assert(env.prov)
	local po = assert(env.po)

	LinkBuildPresetForAnimation(env)

	print_info("[AnimationPreset] run")
end

return run