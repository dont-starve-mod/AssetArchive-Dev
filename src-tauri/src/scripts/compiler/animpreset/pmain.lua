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

local ALL_PRESETLIST = {
	{
		key = "test",
		condition = {"or",
			{"BankIs", "wilson"},
			{"BankIs", "wilsonbeefalo"},
		},
		presets = {
			Preset{
				key = "1",
				title = "preset of test1",
				cmds = {
					{name = "SetBuild", args = {"wilson"}}
				},
				icon = {
					type = "inv",
					type = "book",
					type = nil, xml = "...", tex = "..."
				}
			},
			Preset{
				key = "2",
				cmds = {},
			}
		}
	}
}

local CONDITION = {
	IS_PLAYER = { "BankIs", "wilson", "wilsonbeefalo", "wilson_sit", "wilson_sit_nofaced" },
}

ALL_PRESETLIST.character_base = {
	title = "角色外观",
	condition = CONDITION.IS_PLAYER,
	presets = {
		Preset{
			key = "wilson",
		},
		Preset{
			key = "wendy",
		},
		Preset{
			key = "wx78",
		}
	}
}

table.foreach(ALL_PRESETLIST.character_base.presets, function(_, v)
	v.title = function(po) return po:GetName(v.key) end
	v.cmds = {{name = "SetBuild", args = {v.key}}}
	v.icon = "swap_icon"
end)

ALL_PRESETLIST.equip_hand = {
	title = "工具/武器",
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
		"hair_hat", "head_hat",
	} or {
		"hair_nohat", "hair", "head",
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
	condition = {"or",
		CONDITION.IS_PLAYER,
		{"BankIs", "pigman"}
	},
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

ALL_PRESETLIST.equip_body = {
	title = "背包/护甲",
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
				{name = "OverrideSymbol", args = {"swap_body", "armorruins", "swap_body"}},
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

ALL_PRESETLIST.pig_base = {
	title = "“猪人”外观",
	condition = { "BankIs", "pigman" },
	presets = {
		Preset{
			key = "pigman",
			title = "猪人",
			cmds = {{name = "SetBuild", args = {"pig_build"}}},
			icon = "book" -- TODO: custom
		},
		Preset{
			key = "pig_guard",
			title = "猪人守卫",
			cmds = {{name = "SetBuild", args = {"pig_guard_build"}}},
			icon = "book",
		},
		Preset{
			key = "werepig",
			title = "疯猪",
			cmds = {{name = "SetBuild", args = {"werepig_build"}}},
			icon = "book",
		},
		Preset{
			key = "merm",
			title = "鱼人",
			cmds = {{name = "SetBuild", args = {"merm_build"}}},
			icon = "book" -- TODO:
		},
		Preset{
			key = "monkeymen",
			title = "TODO:",
			cmds = {{name = "SetBuild", args = {"monkeymen_build"}}},
			icon = "book",
		}
	}
}

ALL_PRESETLIST.spider_base = {
	title = "蜘蛛外观",
	condition = { "BankIs", "spider" },
	presets = {
		Preset{
			key = "spider_white",
			cmds = {{name = "SetBuild", args = {"spider_white"}}},
		},
		Preset{
			key = "spider_moon",
			cmds = {{name = "SetBuild", args = {"ds_spider_moon"}}},
		},
		Preset{
			key = "spider_caves2",
			cmds = {{name = "SetBuild", args = {"ds_spider2_caves"}}},
		},
		Preset{
			key = "spider_caves1",
			cmds = {{name = "SetBuild", args = {"ds_spider_caves"}}},
		},
		Preset{
			key = "spider",
			cmds = {{name = "SetBuild", args = {"spider_build"}}},
		},
		Preset{
			key = "spider_warrior",
			cmds = {{name = "SetBuild", args = {"spider_warrior_build"}}},
		},
	}
}

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

ALL_PRESETLIST.color = {
	condition = { "true" },
	order = 999,
	presets = {
		Preset{
			key = nil,
		},
		Preset{
			key = "black",
			title = "纯黑",
			cmds = {
				{name = "SetMultColour", args = {0, 0, 0, 1}},
			},
			icon = "tsx",
		},
		Preset{
			key = "placer_green",
			title = "允许摆放",
			cmds = {
				{name = "SetAddColour", args = {0, 1, 0, 1}},
			},
			icon = "tsx",
		},
		Preset{
			key = "placer_red",
			title = "禁止摆放",
			cmds = {
				{name = "SetAddColour", args = {1, 0, 0, 1}},
			},
			icon = "tsx",
		},
	}
}

-- public fixer
table.foreach(ALL_PRESETLIST, function(k, v)
	v.key = k
	v.order = v.order or 0

	table.foreach(v, function(_, p)
		if p.key == nil then
			p.title = "无"
			p.cmds = {}
		end
	end)
end)

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
		[smallhash("pigman")] = true,
		[smallhash("spider")] = true,
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
				if not index:GetZipFileAbstract(k).has_build then
					related_files[k] = nil
				end
			end
			local force_build = nil
			local num = GetTableSize(related_files)
			local function FilterBy(fn)
				for k in pairs(related_files)do
					if not fn(k) then related_files[k] = nil end
				end
			end
			if num <= 8
				or bankname == "oceanfish_small"
				or bankname == "oceanfish_medium"
				or bankname == "hound"
				or bankname == "beefalo"
				or bankname == "chesspiece" then
				-- add all build files to preset
			elseif bankname == "dumbbell_heat" then
				FilterBy(function(k) return k:startswith("anim/dumbbell_heat") end)
			elseif bankname == "kitcoon" then
				FilterBy(function(k) return k:startswith("anim/kitcoon") end)
			elseif bankname == "cook_pot" then
				FilterBy(function(k) return k:find("cook_pot") and not k:find("cook_pot_food") end)
			elseif bankname == "pumpkin" then
				FilterBy(function(k) return k:find("pumpkin") end)
			elseif bankname == "clock01" then
				FilterBy(function(k) return k:find("clock") end)
			elseif bankname == "chester" then
				FilterBy(function(k) return true end) --  TODO: --> fix it
			elseif bankname == "crow" then
				force_build = {"crow_build", "robin_build", "robin_winter_build"}
			elseif bankname == "crow_kids" then
				force_build = {"crow_kids"}
			elseif bankname == "werebeaver" or bankname == "weregoose" or bankname == "weremoose" then
				force_build = {bankname.."_build"}
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
				table.sort(builds, function(a, b) return a < b end)
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