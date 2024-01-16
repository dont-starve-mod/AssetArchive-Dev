-- main for analyzing dst prefabfiles

assert(_VERSION == "Lua 5.1")
assert(SCRIPT_ROOT ~= nil and #SCRIPT_ROOT > 0, "[Fatal] script root not defined")

local main_result = nil

function table.clear(t)
	local stored = {}
	for k in pairs(t) do
		t[k] = nil
		stored[k] = v
	end
	return stored -- shallow copy of cleared table
end

local AnalyzerMethods = {
	MountScriptZip = function(self, root)
		print_info("[Compiler] Mount `scripts.zip`")
		local script_bundle_path = root/"databundles"/"scripts.zip"
		assert(script_bundle_path:is_file())
		local zip = ZipLoader(FileSystem.CreateReader(script_bundle_path), ZipLoader.NAME_FILTER.ALL_LAZY)
		print_info("[Compiler] zipfile loaded")
		local cache = {}

		-- change loader path to `scripts.zip`
		-- disable local loader
		package.old_loader = package.loaders
		package.loaders = { 
			function(path)
				if cache[path] then return cache[path] end
				if path == "math" or path == "string" or path == "table" then
					return function() return _G[path] end
				end

				local module_path = "scripts/"..path:gsub("[.]", "/")..".lua"
				if zip:Exists(module_path) then
					local c = zip:Get(module_path)
					local f = loadstring(c, module_path)
					cache[path] = f
					return f
				else
					error("file not exists: "..module_path)
				end
			end
		}
	end,

	CreateEnv = function(self)
		print_info("[Compiler] Initalize environment")
		-- disable strict mode
		setmetatable(_G, {})

		-- release all loaded
		package.old_loaded = table.clear(package.loaded)
		package.old_preload = table.clear(package.preload)

		-- dummy os lib
		os = { time = function() return 0 end, clock = function() return 0 end }

		-- c constants
		APP_VERSION = "580000"
		BRANCH = "release"
		METRICS_ENABLED = true
		CAN_USE_DBUI = false
		PLATFORM = "OSX_STEAM"
		POT_GENERATION = false
		ENCODE_SAVES = true

		-- main.lua
		function IsConsole() return false end
		function IsNotConsole() return true end
		function IsPS4()return false end
		function IsXB1() return false end
		function IsSteam() return false end
		function IsWin32() return false end
		function IsLinux() return false end
		function IsRail() return false end
		function IsSteamDeck() return false end

		self:CreateDummyUserdata()

		require "strict"
		global "utf8char"
		global "utf8substr"
		global "utf8strlen"
		global "utf8strtoupper"
		global "utf8strtolower"

		require("class")
		require("prefabs")
		require("vector3")
		require("constants")
		require("mainfunctions")
		require("preloadsounds")
		require("json")
		require("tuning")
		require("mods")
		global "Profile"
		global "LOC"
		Profile = require("playerprofile")()
		-- Profile:Load( nil, true )
		LOC = require("languages/loc")
		require("languages/language")
		require("strings")
		require("stringutil")
		require("dlcsupport_strings")
		require("class")
		require("util")
		-- redirect some util fns
		_G.resolvefilepath_soft = function(...) return "" end
		_G.resolvefilepath = function(...) return "" end
		_G.softresolvefilepath = function(...) return "" end
		require("vecutil")
		require("vec3util")
		require("datagrid")
		require("ocean_util")
		require("actions")
		require("debugtools")
		require("simutil")
		require("scheduler")
		require("stategraph")
		require("behaviourtree")
		require("prefabs")
		require("tiledefs")
		-- require("tilegroups") -- userdata lose :(
		rawset(_G, "lfs", "")
		require("falloffdefs")
		require("groundcreepdefs")
		require("prefabskin")
		rawset(_G, "Entity", {})
		require("entityscript")
		rawset(_G, "walltime", os.clock)
		require("profiler")
		require("recipes")
		require("brain")
		require("emitters")
		require("dumper")
		require("input")
		require("upsell")
		require("stats")
		require("frontend")
		require("netvars")
		require("networking")
		require("networkclientrpc")
		require("shardnetworking")
		require("fileutil")
		require("prefablist")
		require("standardcomponents")
		require("update")
		require("fonts")
		require("physics")
		require("modindex")
		require("mathutil")
		require("components/lootdropper")
		require("reload")
		require("saveindex") -- Added by Altgames for Android focus lost handling
		require("shardsaveindex")
		require("shardindex")
		require("custompresets")
		require("gamemodes")
		require("skinsutils")
		require("wxputils")
		require("klump")
		require("popupmanager")
		require("chathistory")
		require("componentutil")
		require("skins_defs_data")
		require("prefabutil")

		print_info("[Compiler] All ready")
	end,

	CreateDummyUserdata = function(self)
		print_info("[Compiler] Create dummy userdata")
		local function DummyUserdata(name, values, silence)
			values = values or {}
			silence = silence or {}
			local t = setmetatable({}, {
				__index = function(t,k) return 
					function(...) 
						if values[k] ~= nil then
							return values[k]
						elseif silence[k] then
							-- do nothing
						elseif name == "TheInventory" and k:match("^AddScrapbook%d*Key$") then
							-- do nothing
						else
							print_info("Run "..name..":"..k, ...) 
						end
					end 
				end
			})
			_G[name] = t
		end

		DummyUserdata("TheSim", {
			GetTick = 0,
			GetTickTime = 1/30,
		}, {
			AddTextureToStreamingGroup = true,
		})

		DummyUserdata("TheNet", {
			IsDedicated = false,
			GetServerGameMode = "",
		})

		DummyUserdata("TheInputProxy", {
			GetInputDeviceCount = 0,
		})

		DummyUserdata("TheInventory", {}, {
			ClearSkinsDataset = true,
			AddSkinSetInput = true,
			AddSkinLinkInput = true,
			AddSkinDLCInput = true,
			AddCookBookKey = true,
			AddPlantRegistryKey = true,
			AddRestrictedBuildFromLua = true,
			AddEmoji = true,
			ValidateWithSignature = true,
			AddGenericKVKey = true,
			AddSkillTreeKey = true,
			AddFreeItemForEveryone = true,
		})

		DummyUserdata("net_tinybyte")
	end,

	ScanAllPrefabs = function(self)
		-- fake capture functions
		rawset(_G, "Map", {})
		rawset(_G, "prefabs", {})

		local prefabs = {}
		local prefabnames = {}
		local prefabskins = {}
		local placers = {}
		local strict = self.strict

		local old_prefab = Prefab
		_G.Prefab = Class(old_prefab, function(self, ...)
			old_prefab._ctor(self, ...)
			table.insert(prefabs, self)
			prefabnames[self.name] = true
			
			-- get source
			if self.fn == nil then
				return
			end
			local source = debug.getinfo(self.fn).source
			if source then
				self.source = string.sub(source, string.find(source, "[^/]*.lua$"))
			else
				-- It's theoretically impossible, but we should emit a message.
				print_error("Failed to get file source: ", self.name)
				if strict then
					error("runtime error")
				end
			end
		end)

		local old_placer = MakePlacer
		_G.MakePlacer = function(name, bank, build, anim)
			table.insert(placers, {name = name, bank = bank, build = build, anim = anim})
			return {}
		end

		local old_prefabskin = CreatePrefabSkin
		_G.CreatePrefabSkin = function(name, info)
			local prefab = old_prefabskin(name, info)
			table.insert(prefabskins, prefab)
			if prefab.fn ~= nil then
				print_info("prefabskin with source: "..json.encode(prefab))
				if strict then
					error("runtime error")
				end
			else
				prefab.source = "PREFAB_SKIN"
			end
			return prefab
		end

		-- iter PREFABFILES
		require "prefablist"
		for _, name in ipairs(PREFABFILES)do
			local success, result = pcall(require, "prefabs/"..name)
			if not success then
				error("Failed to load prefab: "..name
					.."\n"..result)
			end
		end

		print_info("[Compiler] All prefabfiles are loaded successfully ("..#PREFABFILES..")")

		self.prefabs = prefabs
		self.prefabnames = prefabnames
		self.prefabskins = prefabskins
		self.placers = placers
	end,

	LoadCustomize = function(self)
		local customize = require "map/customize" 
		local worldgen = customize.GetWorldGenOptions(nil, true)
		local worldsettings = customize.GetWorldSettingsOptions(nil, true)
		local customize_data = {}
		for _,options in ipairs{worldgen, worldsettings}do
			for _,v in ipairs(options)do
				-- v.options = nil
				-- v.default = nil
				-- v.widget_type = nil
				local name = assert(v.name)
				local group = assert(v.group)
				local atlas, image = assert(v.atlas), assert(v.image)
				table.insert(customize_data, {
					name = name,
					group = group,
					atlas = atlas,
					image = image,
				})
			end
		end
		self.customize_data = customize_data
	end,

	WriteFile = function(self)
		local prefabs = self.prefabs
		local prefabnames = self.prefabnames
		local prefabskins = self.prefabskins
		local placers = self.placers
		local customize_data = self.customize_data
		
		print_info("[Compiler] Link *_cooked")
		for _,v in pairs(prefabs)do
			local _, _, name = v.name:find("(.*)_cooked")
			if name and prefabnames[name] then
				table.insert(v.deps, name)
			end
		end

		local function GetPlacerDest(name)
			local _, _, prefab = name:find("^(.*)_placer")
			if prefab and prefabnames[prefab] then
				return prefab
			end
			for k,v in pairs(AllRecipes)do
				if v.placer == name then
					return v.product
				end
			end
			print_info("[Warning] No placer target: ".. name)
		end

		print_info("[Compiler] Link prefab placer")
		
		local data = { prefabs = {}, placers = {}, prefabskins = prefabskins, customize = customize_data }
		for k,v in pairs(prefabs)do
			if v.name ~= "global" then
				local assets, deps = {}, {}
				for _, a in ipairs(v.assets)do
					if a.file and #a.file > 0 then
						table.insert(assets, a)
					end
				end
				for _, d in ipairs(v.deps)do
					if #d > 0 then
						table.insert(deps, d)
					end
				end
				if #assets + #deps > 0 then
					v.assets = assets
					v.deps = deps
					table.insert(data.prefabs, v)
				end
			end
		end

		for k,v in pairs(placers)do
			if #v.name then
				v.dest = GetPlacerDest(v.name)
				table.insert(data.placers, v)
			end
		end	

		print_info("[Compiler] write file")

		local output = FileSystem.Path(SCRIPT_ROOT)/"compiler/output/"
		local path = output/"prefab.dat"
		local str = json.encode(data)
		-- it's only for debug, will always failed in release
		pcall(function() path:write(str) end)
		FileSystem.SaveString("prefab.dat", str)

		main_result = data
	end,
}

local function main(GLOBAL)
	print_info("[Compiler] analyzer.main()")

	local analyzer = setmetatable({}, {__index = AnalyzerMethods})
	analyzer.strict = true -- TODO: get from args
	analyzer:MountScriptZip(GLOBAL.root)
	analyzer:CreateEnv()
	analyzer:ScanAllPrefabs()
	analyzer:LoadCustomize()
	analyzer:WriteFile()
	print("[Compiler] done 🎉")

	package.loaders = package.old_loader
	package.preload = package.preload
	package.loaded = package.loaded

	require "asset" -- override dst asset definition

	return main_result
end

return {
	main = main
}