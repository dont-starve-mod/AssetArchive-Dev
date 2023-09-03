-- main for analyzing dst prefabfiles

assert(_VERSION == "Lua 5.1")
assert(SCRIPT_ROOT ~= nil and #SCRIPT_ROOT > 0, "[Fatal] script root not defined")

local main_result = nil

function table.clear(t)
	for k in pairs(t) do
		t[k] = nil
	end
end

local function WriteFile(t)
	local prefabs = t.prefabs
	local prefabnames = t.prefabnames
	local placers = t.placers

	-- link cooked items
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
		print("[Warning] No placer target: ".. name)
	end

	do
		local data = { prefabs = {}, placers = {} }
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

		FileSystem.SaveString("prefab.dat", json.encode(data))

		main_result = data
	end

	print("[Compiler] all progress is done")
end

local function CollectPrefabs()
	rawset(_G, "Map", {})
	rawset(_G, "prefabs", {})

	local prefabs = {}
	local prefabnames = {}
	local placers = {}

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
			print("Warning: cannot get file source: ", self.name)
		end
	end)

	local old_placer = MakePlacer
	_G.MakePlacer = function(name, bank, build, anim)
		table.insert(placers, {name = name, bank = bank, build = build, anim = anim})
		return {}
	end

	require "prefablist"
	for _, name in ipairs(PREFABFILES)do
		local success, result = pcall(require, "prefabs/"..name)
		if not success then
			print("[Warning] Failed to load prefab: "..name)
			print(result)
			print()
			error("abort")
		end
	end

	print("[Compiler] all prefabfiles are loaded successfully ("..#PREFABFILES..")")
	print("[Compiler] write file...")
	WriteFile({
		prefabs = prefabs, 
		prefabnames = prefabnames, 
		placers = placers,
	})
end

local function CreateDummyUserdata()
	local function DummyUserdata(name, values, silence)
		values = values or {}
		silence = silence or {}
		local t = setmetatable({}, {
			__index = function(t,k) return 
				function(...) 
					if values[k] ~= nil then
						return values[k]
					elseif silence[k] then
						-- pass
					else
						print("Run "..name..":"..k, ...) 
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
	})

	DummyUserdata("net_tinybyte")
end

local function main(GLOBAL)
	print("[Compiler] main()")
	local script_bundle_path = GLOBAL.root/"databundles"/"scripts.zip"
	assert(script_bundle_path:is_file())
	local zip = ZipLoader(FileSystem.CreateReader(script_bundle_path), ZipLoader.NAME_FILTER.ALL_LAZY)
	print("[Compiler] zipfile loaded")
	local cache = {}

	-- change loader path to `scripts.zip`
	-- disable local loader
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
				-- print("Load: ", path)
				return f
			else
				error("file not exists: "..module_path)
			end
		end
	}

	-- disable strict mode
	setmetatable(_G, {})
	-- release all loaded
	table.clear(package.loaded)
	table.clear(package.preload)

	-- dummy os lib
	os = {
		time = function() return 0 end,
		clock = function() return 0 end,
	}


	-- c constants
	APP_VERSION = "_"
	BRANCH = "_"
	METRICS_ENABLED = false
	CAN_USE_DBUI = false
	PLATFORM = -1
	POT_GENERATION = -1
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

	CreateDummyUserdata()

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

	print("[Compiler] env init successful")
	CollectPrefabs()

	return main_result
end

return {
	main = main
}