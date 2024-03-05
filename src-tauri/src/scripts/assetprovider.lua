local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local Config = Persistant.Config
local AssetIndex = require "assetindex"
local smallhash = Algorithm.SmallHash_Impl
local CropBytes = Algorithm.CropBytes
local Filenamify = FileSystem.Filenamify
local floor = math.floor

local DST_DataRoot = Class(function(self, explicit_path)
	self.game = "DST"
	self.databundles = {}

	if explicit_path ~= nil then
		self:SetRoot(explicit_path, true)
		return
	end

	local last_dst_root = Config:Get("last_dst_root")
	if last_dst_root and self:SetRoot(last_dst_root) then
		return
	end

	if self:SearchGame() then
		return
	end
end)

function DST_DataRoot:IsValid()
	return self.root ~= nil and self.root:is_dir()
end

function DST_DataRoot:ResolvePath(path)
	assert(type(path) == "userdata") -- FileSystem.Path
	if path:is_dir() and path:name() == "data"
		and (path/"anim"):is_dir()
		and (path/"bigportraits"):is_dir()
		and (path/"images"):is_dir()
		and (path/"minimap"):is_dir()
		and (path/"sound"):is_dir() then
		return path
	end

	local name = path:name()
	if PLATFORM == "MACOS" then
		if path:is_dir() then
            if name == "Don't Starve Together" then
                return self:ResolvePath(path/"dontstarve_steam.app")
            elseif name == "Don't Starve Together Dedicated Server" then
                return self:ResolvePath(path/"dontstarve_dedicated_server_nullrenderer.app")
            elseif name == "dont_starve" then
            	return self:ResolvePath(path/"dontstarve_steam.app")
            elseif name == "dontstarve_steam.app" or name == "dontstarve_dedicated_server_nullrenderer.app" or name == "dontstarve_steam.app" then
                return self:ResolvePath(path/"Contents"/"data")
            elseif name == "Contents" and path:parent():is_dir() then
                return self:ResolvePath(path:parent())
            end
        end
    elseif PLATFORM == "WINDOWS" then
    	if path:is_dir() then
            if name == "Don't Starve Together" or name == "Don't Starve Together Dedicated Server"
            	or name:find("(2000004)") then
                return self:ResolvePath(path/"data")
            end
        elseif path:is_file() then
            if path:check_extention(".exe") and path:parent():name():startswith("bin")
            	and (name:find("dontstarve_steam") or name:find("dontstarve_dedicated_server_nullrenderer") or name:find("dontstarve_rail"))then
            	return self:ResolvePath(path:parent():parent())
            end
        else
        	local parent = path:parent()
        	local parent_name = parent:name()
        	if parent_name == "Don't Starve Together" or parent_name == "Don't Starve Together Dedicated Server"
        		or parent_name:find("(2000004)") then
        		return self:ResolvePath(parent/"data")
        	end
        end
    elseif PLATFORM == "LINUX" then
    	-- TODO
    end
end

-- set the root if the path is a valid dst `data` folder
-- return `true` on success
function DST_DataRoot:SetRoot(path, explicit)
	if type(path) == "string" then
		path = FileSystem.Path(path)
	end
	local path = self:ResolvePath(path)
	if path == nil then
		return false
	end
	if path == self.root then
		Config:SetAndSave("last_dst_root", path:as_string())
		return true
	end

	self.root = path
	local databundles = self:GetDataBundlesRoot()

	if databundles:is_dir() then
		for _, k in ipairs{"images", "bigportraits", "anim_dynamic", "scripts", "shaders"}do
			local zippath = databundles/(k..".zip")
			local fs = zippath:is_file() and FileSystem.CreateReader(zippath)
			if fs then
				local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ALL_LAZY)
				if not zip.error then
					zip.filepath = zippath
					self.databundles[k:gsub("_", "/").."/"] = zip
				end
				zip:Close()
			end
		end
	end

	if explicit == true then
		return true
	else
		Config:SetAndSave("last_dst_root", self.root:as_string())
		return true
	end
end

function DST_DataRoot:SearchGame()
	if PLATFORM == "WINDOWS" then
		for i = 2, 25 do
			local drive = FileSystem.Path(string.char(65 + i) .. ":/")
			if drive:is_dir() then
				local steamapps = drive/"Program Files (x86)/Steam/steamapps/common"
				for _, game in ipairs{
					"Don't Starve Together",
					"Don't Starve Together Dedicated Server",
				}do
					local path = steamapps/game/"data"
					if path:is_dir() and self:SetRoot(path) then
						return true
					end
				end
			end
		end
	elseif PLATFORM == "MACOS" then
		if HOME_DIR ~= nil then
			local steamapps = HOME_DIR/"Library/Application Support/Steam/steamapps/common"
			for _, game in ipairs{
				"Don't Starve Together/dontstarve_steam.app/Contents/data",
				"Don't Starve Together Dedicated Server/dontstarve_dedicated_server_nullrenderer.app/Contents/data",
			}do
				local path = steamapps/game
				if path:is_dir() and self:SetRoot(path) then
					return true
				end
			end
		end
	elseif PLATFORM == "LINUX" then
		-- TODO: Linux install directory
	end
end

function DST_DataRoot:SearchGame()
	return false
end

function DST_DataRoot:Open(path, bundled)
	if self.root then
		if bundled ~= false then
			-- search databundles
			for k,v in pairs(self.databundles)do
				if path:startswith(k) then
					local bytes = v:Get(path)
					if bytes ~= nil then
						return CreateBytesReader(bytes)
					end
				end
			end
		end
		local fullpath = self.root/path
		return CreateReader(fullpath)
	end
end

function DST_DataRoot:Exists(path, bundled)
	if self.root then
		if bundled and self.databundles[bundled] then
			return self.databundles[bundled]:Exists(path)
		elseif bundled ~= false then
			for k,v in pairs(self.databundles)do
				if path:startswith(k) and v:Exists(path) then
					return true
				end
			end
		end
		return (self.root/path):is_file()
	end
end

function DST_DataRoot:Iter(path)
	if self.root then
		local result = {}
		if self.databundles[path] then
			for _,name in ipairs(self.databundles[path]:List())do
				result[name] = true
			end
		end
		for _, file in ipairs((self.root/path):iter_file()) do
			result[path..file:name()] = true -- use hashmap to prevent duplicated names
		end
		return table.getkeys(result)
	end
end

function DST_DataRoot:GetDataBundlesRoot()
	return self.root/"databundles"
end

function DST_DataRoot:__div(path)
	return self.root/path
end

function DST_DataRoot:as_string()
	assert(self.root ~= nil and self.root:is_dir())
	return self.root:as_string()
end

function DST_DataRoot:OpenRootFolder()
	if self.root ~= nil then
		return SelectFileInFolder(self.root:as_string())
	else
		return false
	end
end


local function CalcIndex(w, h, args)
	local rw, rh = args.rw, args.rh
	local index = {}
	if type(rw) == "number" then
		table.insert(index, select(2, math.frexp(w / rw, 2)))
	end
	if type(rh) == "number" then
		table.insert(index, select(2, math.frexp(h / rh, 2)))
	end
	if #index == 0 then
		return 1
	else
		return math.min(unpack(index))
	end
end

local Provider = Class(function(self, root, static)
	self.root = root

	self.allzipfile = {}
	self.alldynfile = {}
	self.allxmlfile = {}
	self.alltexelement = {}
	self.alltexture = {}
	self.allkshfile = {}
	self.allfevfile = {}
	self.allfsbfile = {}

	self.loaders = {
		xml = {},
		tex = {},
		atlas = {},
		build = {},
		animbin = {},
		-- animation = {},
	}

	self.static = static
end)

function Provider:DoIndex(ignore_cache)
	self.index = AssetIndex(self.root)
	self.index:DoIndex(ignore_cache)
end


function Provider:ListAsset()
	print("Start listing asset...")
	for _,v in ipairs((self.root/"anim"):iter_file_with_extension(".zip"))do
		table.insert(self.allzipfile, Asset("animzip", {file = "anim/"..v:name()}))

		-- mark character.zip as deprecated
		local name = v:name()
		local dynname = name:sub(1, #name - 4)..".dyn"
		if self.root:Exists("anim/dynamic/"..dynname, false) then
			self.allzipfile[#self.allzipfile]._depricated_redirect = {
				Asset("animdyn", {file = "anim/dynamic/"..dynname}):GetID()
			}
		end
	end

	for _,v in ipairs((self.root/"anim"/"dynamic"):iter_file_with_extension(".dyn"))do
		local name = v:name()
		local zipname = name:sub(1, #name - 4)..".zip"
		if not self.root:Exists("anim/dynamic/"..zipname, "anim/dynamic") then
			print("Warning: dyn file without build zip: "..name)
		else
			table.insert(self.alldynfile, Asset("animdyn", {file = "anim/dynamic/"..v:name()}))
		end
	end

	local texpath_refs = {}
	local texpath_all = {}

	for _, folder in ipairs{"minimap", "images", "bigportraits"}do
		for _,v in ipairs(self.root:Iter(folder.."/") or {}) do
			if v:endswith(".xml") then
				local f = self.root:Open(v)
				if not f then
					print("Warning: failed to open xml file: "..v)
				else
					local xml = XmlLoader(f)
					if not xml.error then
						local texname = xml.texname
						local _,_, parent = string.find(v, "^(.*/)[^/]+$")
						local texpath = parent and parent .. texname
						if not self.root:Exists(texpath) then
							if not texname:find("motd_box") then
								print("Warning: cannot find tex file that xml references to: ",
									v, "->", texpath)
							end
						else
							texpath_refs[texpath] = true
							table.insert(self.allxmlfile, Asset("xml", {
								file = v,
								texname = texname,
								texpath = texpath,
								_numtex = GetTableSize(xml.imgs),
							}))
							for name in pairs(xml.imgs)do
								table.insert(self.alltexelement, Asset("tex", {
									xml = v,
									tex = name,
								}))
							end
						end
					end
				end
			elseif v:endswith(".tex") then
				texpath_all[v] = true
			end
		end
	end

	-- TODO: 单机版材质还有其他目录
	for _, v in ipairs(self.root:Iter("levels/textures/"))do
		if v:endswith(".tex") then
			texpath_all[v] = true
		end
	end

	for _,v in ipairs(self.root:Iter("images/colour_cubes/"))do
		if v:endswith(".tex") then
			texpath_all[v] = true
		end
	end

	for k in pairs(texpath_all)do
		if not texpath_refs[k] then
			table.insert(self.alltexture, Asset("tex_no_ref", {
				file = k,
				_is_cc = k:startswith("images/colour_cubes/") and true or nil,
				_short_name = string.sub(k, k:find("[^/]*$")),
			}))
		end
	end

	-- mark deprecated assets
	local temp = {}
	local inventoryimages_new = {}
	for _,v in ipairs(self.allxmlfile)do
		if v.file == "images/inventoryimages.xml" then
			table.insert(temp, v)
		elseif v.file:startswith("images/inventoryimages") then
			table.insert(inventoryimages_new, v:GetID())
		end
	end
	for _,v in ipairs(self.alltexelement)do
		if v.xml == "images/inventoryimages.xml" then
			table.insert(temp, v)
		end
	end

	table.foreach(temp, function(_, v) v._depricated_redirect = inventoryimages_new end)

	for _, v in ipairs(self.root:Iter("shaders/"))do
		if v:endswith(".ksh") then
			local ksh = KshLoader(self.root:Open(v, true))
			if ksh.error then
				print("Error loading ksh:")
				print(ksh.error)
			else
				table.insert(self.allkshfile, Asset("shader", {
					file = v,
					_ps = ksh.ps,
					_vs = ksh.vs,
				}))
			end
		end
	end
	print("Shader done")

	for _, v in ipairs(self.root:Iter("sound/"))do
		if v:endswith(".fev") then
			local fev = FevLoader(self.root:Open(v, false))
			if not fev.error then
				table.insert(self.allfevfile, fev)
			end
		end
		if v:endswith(".fsb") then
			local f = self.root:Open(v, false)
			local fsb = FsbLoader(f)
			if not fsb.error then
				table.insert(self.allfsbfile, fsb)
				fsb.filepath = f:path()
				fsb.filestem = NameOf(v)
			end
		end
	end
	print("Sound done")

	self.assets = {
		allzipfile = self.allzipfile,
		alldynfile = self.alldynfile,
		allxmlfile = self.allxmlfile,
		alltexelement = self.alltexelement,
		alltexture = self.alltexture,
		allkshfile = self.allkshfile,
		-- NOTE: fev and fsb are lazy loaded (not indexed by search engine)
		-- allfevfile = self.allfevfile,
		-- allfsbfile = self.allfsbfile,
	}

	-- link fev reference to fsb
	local fsb_map = {}
	for _,fsb in ipairs(self.allfsbfile)do
		fsb_map[fsb.filestem] = fsb
	end
	for _,fev in ipairs(self.allfevfile)do
		fev:LinkToFsb(fsb_map)
	end

	print("Finish")
end

function Provider:ResolveInvImage(file)
	for n = 1, 5 do
		local path = "images/inventoryimages"..n..".xml"
		local xml = self:LoadXml(path)
		if xml ~= nil then
			local info = xml:GetLoosely(file)
			if info ~= nil then
				return path, info.name
			end
		else
			break
		end
	end
	for _, spice in ipairs{"garlic", "sugar", "salt", "chili"} do
		if file:endswith("spice_"..spice) then return end
	end
	if file:endswith("oversized_rot") then return end
	if file:find("tomato") or file:find("onion") then return end -- 忽略暴食作物（和游戏本体共用图片素材）
	if file:startswith("yotc_carrat_gym") or file:startswith("yotr_decor") then return end
	if file == "abigail_flower_wilted" or file == "kullkelp_root" then return end -- depricated prefabs

	print("Warning: failed to resolve inventoryimage: "..file)
end

function Provider:ResolveMinimapImage(file)
	for _, n in ipairs{"", "1", "2", "3"}do
		local path = "minimap/minimap_data"..n..".xml"
		local xml = self:LoadXml(path)
		if xml ~= nil then
			local info = xml:GetLoosely(file)
			if info ~= nil then
				return path, info.name
			end
		end
	end

	if file == "moon_device" then return end -- what's this?
	
	print("Warning: failed to resolve minimap image: "..file)
end

function Provider:Load(args)
	local type = args.type
	if type == "build" then
		if args["get_symbol_list"] then
			return self:GetBuildSymbolList(args)
		else
			return self:GetBuildData(args)
		end
	elseif type == "bank" then
		return self:GetBank(args)
	elseif type == "animation" then
		return self:GetAnimation(args)
	elseif type == "atlas" then
		return self:GetAtlas(args)
	elseif type == "atlas_preview" then
		return self:GetAtlasPreview(args)
	elseif type == "image" then
		return self:GetImage(args)
	elseif type == "image_with_cc" then
		return self:GetImageWithCC(args)
	elseif type == "texture" then
		return self:GetTexture(args)
	elseif type == "xml" then
		return self:GetXml(args)
	elseif type == "symbol_element" then
		return self:GetSymbolElement(args)
	elseif type == "animbin" then
		return self:GetAnimBin(args)
	elseif type == "fev_ref" then
		return self:GetFevRef(args)
	elseif type == "fev_abstract" then
		return self:GetFevAbstract(args)
	elseif type == "shader_src" then
		return self:GetShaderSource(args)
	elseif type == "show" then
		return self:ShowAssetInFolder(args)
	end
end

local old_Load = Provider.Load
function Provider:Load(args)
	local type = args.type
	local time = now()
	local result = { old_Load(self, args) }
	print("[LOAD] type="..type..", args="..json.encode(args))
	if now() - time > 50 then
		print("  time = "..string.format("%.1f", now() - time))
	end
	return unpack(result)
end

function Provider:GetBuild(args)
	local path = nil 
	if type(args.file) == "string" then
		path = args.file
	end
	if type(args.name) == "string" or type(args.build) == "string" then
		path = self.index:GetBuildFile(args.name or args.build)
	end
	if path ~= nil then
		if path:endswith(".dyn") then
			-- check build file for dyn
			local path_build = path:sub(1, #path - 4) .. ".zip"
			if self.root:Exists(path_build) then
				local build = self:LoadBuild(path_build, args.lazy)
				return build
			end
		else
			local build = self:LoadBuild(path, args.lazy)
			return build
		end
	end
end

function Provider:GetBuildData(args)
	local build = self:GetBuild(args)
	return build and build.builddata
end

function Provider:GetBuildSymbolList(args)
	args.lazy = true
	local build = self:GetBuild(args)
	return build and build.symbol_collection
end

function Provider:LoadBuild(path, lazy)
	if self.loaders.build[path] then
		return self.loaders.build[path]
	end

	local fs = self.root:Open(path)
	if fs ~= nil then
		local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.BUILD)
		if not zip.error then
			local build_raw = zip:Get("build.bin")
			if build_raw == nil then
				self.loaders.build[path] = false
				return false
			end
			local build = build_raw and BuildLoader(CreateBytesReader(build_raw), lazy)
			if build and not build.error then
				if not lazy then -- don't cache lazy loader
					self.loaders.build[path] = build
				end
				return build
			end
		end
	end
end

function Provider:GetBank(args)
	local bank = args.bank
	if type(bank) == "string" then
		bank = smallhash(bank)
	end
	if type(bank) == "number" then
		local data = self.index.animinfo[bank]
		if not data then
			return json.encode_compliant{}
		end
		-- get all animation list for a bank with basic info: name, facing, numframes, asset
		-- (detailed frame data are ignored)
	
		timeit(true) ---*
		local all_paths = {}
		for _, info in pairs(data)do
			for k in pairs(info.files)do
				all_paths[k] = true
			end
		end
		-- iter all assetpath and collect animation with bank
		local result = {}
		all_paths = ToArray(all_paths)
		table.sort(all_paths)
		local index = 0
		for _, path in ipairs(all_paths)do
			local anim = self:LoadAnim(path)
			if anim then
				for _,v in ipairs(anim.animlist)do
					if v.bankhash == bank then
						index = index + 1
						table.insert(result, {
							id = v.bankhash.."-"..index,
							name = v.name,
							facing = v.facing,
							framerate = v.framerate,
							numframes = v.numframes,
							assetpath = path, -- anim/xxxx.zip
						})
					end
				end
			end
		end
		timeit()  ------*
		return result
	end
end

function Provider:GetAnimation(args)
	if type(args.name) == "string" and 
		(type(args.bank) == "string" or type(args.bank) == "number") then
		-- convert bank to number
		local bank = type(args.bank) == "string" and smallhash(args.bank) or args.bank 
		local paths = self.index:GetAnimFileList(bank, args.name)
		if paths then
			local result = {}
			for k in pairs(paths) do
				print(">")
				local anim = self:LoadAnim(k)
				print("Loaded", k)
				if anim then
					for _,v in ipairs(anim.animlist)do
						if v.name == args.name and v.bankhash == bank then
							anim:ParseFrames(v)
							table.insert(result, v) -- TODO: v.assetpath ?
						end
					end
				end
			end
			table.sort(result, function(a, b) return a.facing > b.facing end)
			return result
		end
	end
end

function Provider:GetAnimBin(args)
	if type(args.file) == "string" then
		local anim = self:LoadAnim(args.file)
		if not anim then
			return {}
		else
			local result = {}
			for _,v in ipairs(anim.animlist)do
				anim:ParseFrames(v)
				table.insert(result, v)
			end

			return result
		end
	end
end

function Provider:LoadAnim(path)
	if self.loaders.animbin[path] ~= nil then
		return self.loaders.animbin[path]
	end
	local fs = self.root:Open(path)
	if fs ~= nil then
		local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ANIM)
		if not zip.error then
			local anim_raw = zip:Get("anim.bin")
			if anim_raw == nil then
				self.loaders.animbin[path] = false 
				return false
			end
			local anim = AnimLoader(CreateBytesReader(anim_raw))
			if anim and not anim.error then
				self.loaders.animbin[path] = anim
				return anim
			end
		end
	end
end

function Provider:GetAtlasPreview(args)
	if type(args.file) == "string" then
		local file = self.index:GetBuildFile(args.file)
		local build = file and self:LoadBuild(file)
		if build then
			if args.id == "list" then
				local result = {}
				for i = 1, build.numatlases do
					table.insert(result, i - 1)
				end
				if build.swap_icon_0 ~= nil then
					table.insert(result, "swap_icon")
				end
				return result
			elseif args.id == "auto" then
				args.id = build.swap_icon_0 ~= nil and "swap_icon" or 0
				return self:GetAtlasPreview(args)
			elseif args.id == "swap_icon" then
				args.imghash = SWAP_ICON
				args.index = 0
				args.format = "png"
				args.build = file
				return self:GetSymbolElement(args)
			elseif type(args.id) == "number" then
				args.sampler = args.id
				args.format = "png"
				args.build = file
				return self:GetAtlas(args)
			end
		else
			-- pure animation package
			if args.id == "list" then
				return {} 
			else
				return ""
			end
		end
	end
end

function Provider:GetAtlas(args)	
	if args.sampler == nil then
		args.sampler = 0 -- note: atlas sampler index starts at 0
	end
	if type(args.build) == "string" then
		local atlaslist = self:LoadAtlas(args.build)
		if atlaslist then
			local atlas = atlaslist[args.sampler]
			if atlas ~= nil then
				local w, h = atlas:GetSize()
				local index = CalcIndex(w, h, args)
				if args.format == "rgba" then
					return { width = w, height = h, bytes = atlas:GetImageBytes(index) }
				elseif args.format == "img" then
					return atlas:GetImage(index)
				elseif args.format == "png_base64" then
					return atlas:GetImage(index):save_png_base64()
				elseif args.format == "png" then
					return atlas:GetImage(index):save_png_bytes()
				elseif args.format == "copy" then
					if atlas.is_dyn then
						return DYN_ENCRYPT
					else
						return Clipboard.WriteImage_Bytes(atlas:GetImageBytes(0), w, h)
					end
				elseif args.format == "save" then
					if atlas.is_dyn then
						return DYN_ENCRYPT
					else
						local img = atlas:GetImage(0)
						if img ~= nil then
							return img:save(args.path) and args.path
						end
					end
				elseif args.format == "permission" then
					if atlas.is_dyn then
						return DYN_ENCRYPT
					else
						return true
					end
				end
			end
		end
	end
end

function Provider:LoadAtlas(name) --> atlaslist
	if self.loaders.atlas[name] then
		return self.loaders.atlas[name]
	end

	local path = self.index:GetBuildFile(name)
	local build = path and self:LoadBuild(path)
	if build then
		local atlas = build.atlas
		local zippath = self.root/path
		if path:startswith("anim/dynamic") then
			zippath = zippath:with_extension(".dyn")
		end
		if not zippath:is_file() then
			print("Warning: LoadAtlas: file not exists: "..tostring(zippath))
			return
		end
		local fs = CreateReader(zippath)
		if fs == nil then
			print("Warning: LoadAtlas: failed to open: "..tostring(zippath))
			return
		end
		local sig = fs:read_exact(6) or ""
		local zip = nil
		fs:rewind()
		if sig:startswith(ZIP_SIG) then
			zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ALL)
		elseif sig == DYN_SIG then
			zip = DynLoader(fs)
			zip.is_dyn = true
			build.is_dyn = true
		else
			print("Warning: LoadAtlas: invalid file sig")
			return
		end
		if zip.error then
			return
		end
		local atlaslist = {}
		for i,name in ipairs(build.atlas)do
			local raw = zip:Get(name)
			if raw ~= nil then
				local tex = TexLoader(CreateBytesReader(raw))
				if not tex.error then
					tex.n = i - 1
					tex.is_dyn = zip.is_dyn
					atlaslist[i - 1] = tex
				end
			end
		end
		self.loaders.atlas[name] = atlaslist
		return atlaslist
	end
end

local function unsigned(v) 
	return math.max(0, math.floor(v + 0.5)) 
end

function Provider:GetSymbolElement(args)
	if type(args.build) == "string" then
		if args.imghash == nil and args.imgname ~= nil then
			args.imghash = smallhash(args.imgname)
		end
		args.build = self.index:GetBuildFile(args.build) -- TODO: 这里的逻辑太糟糕了，得优化
		local build = self:LoadBuild(args.build)
		local atlaslist = self:LoadAtlas(args.build)
		local allow_copy = args.imghash == SWAP_ICON and args.index == 0
		if build and atlaslist then
			local symbol = build.symbol_map[args.imghash]
			if symbol ~= nil then
				local i, j = BinSearch(symbol.imglist, function(img) return img.index - args.index end, nil, args.index + 1)
				if i == nil then
					-- some element[0] has index > 0
					if symbol.imglist[1] and symbol.imglist[1].index > args.index then
						i = 1
					else
						return
					end
				end
				if j ~= nil and args.fill_gap ~= true then -- if fill gap, then redirect xxxx-1 to xxxx-0 (0, 2, 4, ...)
					return
				end
				local img = symbol.imglist[i]
				if img.blank then
					if args.format == "img" then
						return Image.From_RGBA("\0\0\0\0", 1, 1)
					end
					return nil
				end
				local atlas = atlaslist[img.sampler]
				if atlas == nil then
					error("Failed to get atlas: "..json.encode(img).." -> "..args.build.."["..tostring(img.sampler).."]")
				end
				local w, h = atlas:GetSize()
				local x_scale = w / img.cw
				local y_scale = h / img.ch
				local bbx, bby, subw, subh = 
					unsigned(img.bbx * x_scale),
					unsigned(img.bby * y_scale),
					unsigned(img.w * x_scale),
					unsigned(img.h * y_scale)

				if args.format == "png" then
					return Image.From_RGBA(CropBytes(atlas:GetImageBytes(0), w, h, bbx, bby, subw, subh), subw, subh):save_png_bytes()
				elseif args.format == "img" then
					local img = Image.From_RGBA(CropBytes(atlas:GetImageBytes(0), w, h, bbx, bby, subw, subh), subw, subh)
					if args.resize == true then
						-- resize image by source canvas resolution, see renderer.lua
						img = img:resize(math.floor(0.5 + subw/x_scale), math.floor(0.5 + subh/y_scale))
					end
					return img
				elseif args.format == "copy" then
					if atlas.is_dyn and not allow_copy then
						return DYN_ENCRYPT
					else
						return Clipboard.WriteImage(atlas:GetImage(0):crop(bbx, bby, subw, subh))
					end
				elseif args.format == "save" then
					if atlas.is_dyn and not allow_copy then
						return DYN_ENCRYPT
					else
						local img = Image.From_RGBA(CropBytes(atlas:GetImageBytes(0), w, h, bbx, bby, subw, subh), subw, subh)
						if img ~= nil then
							return img:save(args.path) and args.path
						end
					end
				elseif args.format == "permission" then
					if atlas.is_dyn and not allow_copy then
						return DYN_ENCRYPT
					else
						return true
					end
				end
			end
		end
	end
end

function Provider:GetImage(args)
	if type(args.xml) == "string" and type(args.tex) == "string" and type(args.format) == "string" then
		local xml = self:LoadXml(args.xml)
		if xml ~= nil then
			local info = xml:Get(args.tex)
			if info == nil then
				if args.tex:startswith("@ATLAS") then
					info = {u1 = 0, u2 = 1, v1 = 0, v2 = 1}
				else
					error("invalid tex element name: "..args.tex.." in xml: "..args.xml)
				end
			end
			local u1, u2, v1, v2 = info.u1, info.u2, info.v1, info.v2
			local _, tex = self:LoadXmlWithTex(args.xml) -- tex must be valid, otherwise error()
			local w, h = tex:GetSize()
			local ew = math.min(w, floor(w*u2)+1) - math.max(0, floor(w*u1))
			local eh = math.min(h, floor(h*(1-v1))+1) - math.max(0, floor(h*(1-v2)))
			local index = CalcIndex(ew, eh, args)
			local bytes = tex:GetImageBytes(index)
			local w, h = tex:GetSize(index)
			local rect = {
				math.max(0, floor(w*u1)), math.max(0, floor(h*(1-v2))), 
				math.min(w, floor(w*u2)+1), math.min(h, floor(h*(1-v1))+1)
			}
			local ew, eh = rect[3] - rect[1], rect[4] - rect[2]
			bytes = CropBytes(bytes, w, h, rect[1], rect[2], ew, eh)
			if args.format == "rgba" then
				return { width = ew, height = eh, bytes = bytes }
			elseif args.format == "img" then
				return Image.From_RGBA(bytes, ew, eh)
			elseif args.format == "png" then
				return Image.From_RGBA(bytes, ew, eh):save_png_bytes()
			elseif args.format == "copy" then
				return Clipboard.WriteImage_Bytes(bytes, ew, eh)
			elseif args.format == "save" then
				local img = Image.From_RGBA(bytes, ew, eh)
				if img ~= nil then
					return img:save(args.path) and args.path
				end
			end
		end
	end
end

function Provider:GetTexture(args)
	if type(args.file) == "string" and type(args.format) == "string" then
		local tex = self:LoadTex(args.file)
		if tex ~= nil then
			local w, h = tex:GetSize(0)
			local index = CalcIndex(w, h, args)
			if args.format == "rgba" then
				return { width = w, height = h, bytes = tex:GetImageBytes(index)}
			elseif args.format == "img" then
				return tex:GetImage(index)
			elseif args.format == "png" then
				return tex:GetImage(index):save_png_bytes()
			elseif args.format == "copy" then
				return Clipboard.WriteImage_Bytes(tex:GetImageBytes(index), w, h)
			elseif args.format == "save" then
				return tex:GetImage(index):save(args.path) and args.path
			end
		end
	end
end

function Provider:GetImageWithCC(args)
	if type(args.cc) == "string" then
		local tex = self:LoadTex(args.cc)
		local w, h = tex:GetSize(0)
		local cc_bytes = tex:GetImageBytes(0)
		local result_format = args.format
		if args.cc:endswith("quagmire_cc.tex") then
			-- it's 960*30, why...
			cc_bytes = Image.From_RGB(cc_bytes, w, h):resize(1024, 32):to_bytes()
		else
			assert(w == 1024, "cc width must be 1024")
			assert(h == 32, "cc height must be 32")
		end

		args.format = "img"
		args.cc = nil
		args.type = args.sourceType
		local img = self:Load(args)
		args.format = result_format

		if img == DYN_ENCRYPT then
			return img
		elseif type(img) == "userdata" then
			img = img:clone()
			img:apply_cc(cc_bytes, args.percent or 1)
			if args.format == "img" then
				return img
			elseif args.format == "png" then
				return img:save_png_bytes()
			elseif args.format == "copy" then
				return Clipboard.WriteImage(img)
			elseif args.format == "save" then
				return img:save(arg.path) and args.path
			end
		end
	end
end

function Provider:GetImageWithInsanityShader(args)
	-- a dedicated image postprocessor by cpu calculation, for debug only
	args.format = "img"
	args.type = args.sourceType
	local img = self:Load(args)

	if type(img) ~= "userdata" then
		error("Failed to load img: "..json.encode(args))
	end

	local img1 = img:clone()
	local w, h = img:size()
	local img2 = img:affine_transform(w, h, {1,0,0,1,
		math.floor(w* 0.1),
		math.floor(h* -0.2),
	}, Image.NEAREST)
	-- merge two imgs
	for y = 0, h - 1 do
		for x = 0, w - 1 do
			local pixel1 = img1:get_pixel(x, y)
			local pixel2 = img2:get_pixel(x, y)
			local x_offset = math.abs(x - w / 2) / w 
			local y_offset = math.abs(y - h / 2) / h
			local percent = 2 *( x_offset * x_offset + y_offset * y_offset )
			local pixel = {} -- target
			for i = 1, 3 do
				pixel[i] = pixel1[i] * (1-percent) + pixel2[i] * percent
				pixel[i] = math.clamp(pixel[i], 0, 255)
			end
			pixel[4] = 255
			img2:put_pixel(x, y, pixel)
		end
	end
	img2:save("test_insanity.png")
	exit()
end

function Provider:LoadXml(path)
	if self.loaders.xml[path] ~= nil then
		return self.loaders.xml[path]
	end

	if self.root:Exists(path) then
		local fs = self.root:Open(path)
		if fs ~= nil then
			local xml = XmlLoader(fs)
			if not xml.error then
				self.loaders.xml[path] = xml
				return xml
			end
		end
	end
end

function Provider:LoadTex(path)
	if self.loaders.tex[path] ~= nil then
		return self.loaders.tex[path]
	end

	local fs = self.root:Open(path)
	if fs ~= nil then
		local tex = TexLoader(fs)
		if not tex.error then
			self.loaders.tex[path] = tex
			return tex
		end
	end
end

function Provider:LoadXmlWithTex(xmlpath)
	local xml = self:LoadXml(xmlpath)
	if xml ~= nil then
		if xml.tex ~= nil then
			return xml, xml.tex
		end
		-- link tex to xml
		local texname = xml.texname
		local _, _, parent = string.find(xmlpath, "^(.*/)[^/]+$")
		if parent == nil then
			error("Failed to get parent path of: "..xmlpath)
		end
		local tex = self:LoadTex(parent..texname)
		if tex == nil then
			error("Failed to load texture that xml references to: "..xmlpath.." -> "..texname)
		end
		xml.tex = tex
		return xml, tex
	end
end


function Provider:GetXml(args)
	if type(args.file) == "string" then
		local xml = self:LoadXml(args.file)
		if xml ~= nil then
			-- this api will also load .tex file
			local _, tex = self:LoadXmlWithTex(args.file)
			local w, h = tex:GetSize()
			local get_id = TexElementIdGetter(args.file)
			local result = {
				xml = args.file,
				width = w,
				height = h,
				elements = {}
			}
			for k,info in pairs(xml.imgs)do
				local u1, u2, v1, v2 = info.u1, info.u2, info.v1, info.v2
				-- element width/height
				local ew = math.min(w, floor(w*u2)+1) - math.max(0, floor(w*u1))
				local eh = math.min(h, floor(h*(1-v1))+1) - math.max(0, floor(h*(1-v2)))
				table.insert(result.elements, {
					name = k, 
					uv = { u1, u2, v1, v2 },
					width = ew, 
					height = eh,
					id = get_id(k)
				})
			end
			return result
		end
	end
end

function Provider:BatchDownload(args)
	local type = args.type
	local target_dir = assert(args.target_dir, "args.target_dir not provided")
	target_dir = FileSystem.Path(target_dir)
	assert(target_dir:exists(), "target_dir not exists")
	assert(target_dir:is_dir(), "target_dir is not a directory")
	local function CreateOutputDir(file)
		local output_dir_name = Filenamify(NameOf(file))
		local output_dir_path = target_dir/output_dir_name
		for i = 1, 1000 do
			if not output_dir_path:exists() then
				assert(output_dir_path:create_dir(), "Failed to create new directory: "..tostring(output_dir_path))
				break
			else
				output_dir_path = target_dir/(output_dir_name.."_"..i)
			end
		end
		return output_dir_path
	end
	if type == "xml" then
		local file = args.file
		local xml, tex = self:LoadXmlWithTex(file)
		assert(xml, "Failed to load xml: "..tostring(file))
		local total = GetTableSize(xml.imgs)
		local function OnProgress(i)
			IpcEmitEvent("progress", json.encode_compliant{ current = 0, total = total })
		end
		local i = 0
		local atlas_bytes = tex:GetImageBytes(0)
		local w, h = tex:GetSize()
		local output_dir_path = CreateOutputDir(file)
		for k,info in pairs(xml.imgs)do
			local name = info.name
			local u1, u2, v1, v2 = info.u1, info.u2, info.v1, info.v2
			local rect = {
				math.max(0, floor(w*u1)), math.max(0, floor(h*(1-v2))), 
				math.min(w, floor(w*u2)+1), math.min(h, floor(h*(1-v1))+1)
			}
			local crop = CropBytes(atlas_bytes, w, h, 
				rect[1], rect[2], rect[3] - rect[1], rect[4] - rect[2])
			local img = Image.From_RGBA(crop, rect[3] - rect[1], rect[4] - rect[2])
			if name:endswith(".tex") then
				name = name:sub(1, #name - 4)..".png"
			end
			if not name:endswith(".png") then
				name = name..".png"
			end
			img:save((output_dir_path/name):as_string())
			i = i + 1
			OnProgress(i)
			-- TODO: write xls file
		end
		IpcEmitEvent("progress", json.encode_compliant{ done = true })
		return json.encode_compliant{ success = true, output_dir_path = output_dir_path:as_string() }
	elseif type == "build" then
		local file = args.build or args.file
		local build = self:LoadBuild(self.index:GetBuildFile(file))
		assert(build, "Failed to load build "..tostring(file))
		local atlaslist = self:LoadAtlas(file)
		assert(atlaslist, "Failed to load atlaslist "..tostring(file))
		local output_dir_path = CreateOutputDir(file)
		-- TODO: progress
		for hash, v in pairs(build.symbol_map)do
			local symbol_name = HashLib:Hash2String(hash) or "HASH-"..hash
			for _, img in ipairs(v.imglist)do
				local index = img.index
				if img.blank then
					local f = Image.From_RGBA("\0\0\0\0", 1, 1)
					f:save((output_dir_path/(symbol_name.."-"..index..".png")):as_string())
				else
					local sampler = assert(img.sampler, "Failed to get img sampler for `"..file.."`")
					local atlas = atlaslist[sampler]
					if atlas == nil then
						error("Failed to get build sampler for `"..file.."` ["..sampler.."]")
					end
					if atlas.is_dyn and not (hash == SWAP_ICON and index == 0) then
						-- skip export skin assets
					else
						local w, h = atlas:GetSize()
						local x_scale = w / img.cw
						local y_scale = h / img.ch
						local bbx, bby, subw, subh = 
							unsigned(img.bbx * x_scale),
							unsigned(img.bby * y_scale),
							unsigned(img.w * x_scale),
							unsigned(img.h * y_scale)
						local f = Image.From_RGBA(CropBytes(atlas:GetImageBytes(0), w, h, bbx, bby, subw, subh), subw, subh)
						f:save((output_dir_path/(symbol_name.."-"..index..".png")):as_string())
						-- TODO: xls info
					end
				end
			end
		end
		IpcEmitEvent("progress", json.encode_compliant{ done = true })
		return json.encode_compliant{ success = true, output_dir_path = output_dir_path:as_string() }
	elseif type == "fev_ref" then
		local event = args.path -- dontstarve/common/together/spawn_vines/spawnportal_armswing
		local data = self:GetFevRef(args)
		assert(data, "Failed to load fev ref: "..tostring(event))
		local args_data = {}
		local count = 0
		if args.file_index ~= nil then -- single file download using batch api :p
			local v = assert(data.file_list[args.file_index + 1]) -- convert js index to lua
			args_data[v.fsb_name] = { v.file_index }
			count = 1
		else
			for _,v in ipairs(data.file_list)do
				if args_data[v.fsb_name] == nil then
					args_data[v.fsb_name] = {}
				end
				table.insert(args_data[v.fsb_name], v.file_index)
				count = count + 1
			end
		end
		if count > 1 then
			local output_dir_path = CreateOutputDir((string.gsub(event, "/", "_")))
			for fsb_name, index_list in pairs(args_data)do
				local index_list_str = table.concat(index_list, ",")
				print("Extracting from "..fsb_name.." ["..index_list_str.."]")
				local fsb_path_str = (self.root/"sound"/fsb_name):as_string()..".fsb" -- TODO: use some generic code...
				FsbExtractSync(
					fsb_path_str,
					index_list,
					output_dir_path
				)
			end
			return json.encode_compliant{ success = true, output_dir_path = output_dir_path:as_string() }
		elseif count == 1 then
			local fsb_name, index_list = next(args_data)
			print("Extracting from "..fsb_name.." ["..index_list[1].."]")
			local fsb_path_str = (self.root/"sound"/fsb_name):as_string()..".fsb" -- TODO: use some generic code...
			local output = FsbExtractSync(
				fsb_path_str,
				index_list,
				target_dir
			)
			-- select file (not parent folder)
			local wave_path = string.sub(output[1], select(2, string.find(output[1], "PATH: ")) + 1, #output[1])
			return json.encode_compliant{ success = true, output_dir_path = (target_dir/wave_path):as_string() }
		else
			error("No sound file to export: "..event)
		end
	end
end

function Provider:GetFevRef(args)
	if args.format == "save" then
		local file_index = assert(args.file_index)
		local fsb_name = assert(args.fsb_name)
		local path = assert(args.path)
		-- TODO -->
		local fsb_path_str = (self.root/"sound"/fsb_name):as_string()..".fsb"
		-- file rename not impl...
		error("not impl")
	elseif type(args.path) == "string" then
		for _,v in ipairs(self.allfevfile)do
			local event = v:GetEventByPath(args.path)
			if event ~= nil then
				return event
			end
		end
	end
end

function Provider:GetFevAbstract(args)
	if type(args.path) == "string" then
		for _,v in ipairs(self.allfevfile)do
			print(v.project_name)
			if args.path:endswith(v.project_name..".fev") then
				local result = {}
				for k,info in pairs(v.event_map)do
					result[k] = {
						has_sounddef = info.has_sounddef,
					}
				end
				return result
			end
		end
	end
end

-- function Provider:GetShaderSource(args)
-- 	if type(args.file) == "string" then
-- 		for _,v in ipairs(self.allkshfile)do
-- 			if v.file 

function Provider:ShowAssetInFolder(args)
	if not self.root or not self.root:IsValid() then 
		return false 
	end

	local file = args.file
	local fullpath = self.root/file
	local parent = fullpath:parent()
	local is_subitem = false
	for i = 1, 10 do
		if parent == self.root.root then
			is_subitem = true
			break
		else
			parent = parent:parent()
		end
	end
	assert(is_subitem, "Param invalid: "..args.file)
	if fullpath:exists() then
		return SelectFileInFolder(fullpath:as_string())
	end

	for k,v in pairs(self.root.databundles)do
		if file:startswith(k) then
			if v:Exists(file) then
				if args.select_databundle == true then
					return SelectFileInFolder(v.filepath:as_string())
				else
				 	local extracted_path = self.root:GetDataBundlesRoot()/file
				 	if extracted_path:is_file() then
				 		return SelectFileInFolder(extracted_path)
				 	else
						return json.encode_compliant({is_databundle = true, path = v.filepath:name()})
					end
				end
			end
		end
	end

	error("Failed to select asset file:\n"..json.encode_compliant(args))
end

return {
	DST_DataRoot = DST_DataRoot,
	Provider = Provider,
}