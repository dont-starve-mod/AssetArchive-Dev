local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local Config = Persistant.Config
local AssetIndex = require "assetindex"
local smallhash = Algorithm.SmallHash_Impl
local CropBytes = Algorithm.CropBytes
local floor = math.floor

local DST_DataRoot = Class(function(self, suggested_root)
	self.game = "DST"
	self.databundles = {}

	if suggested_root ~= nil and self:SetRoot(suggested_root) then
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

function DST_DataRoot:ResolvePath(path)
	assert(type(path) == "userdata") -- FileSystem.Path
	if path:is_dir() and path:name() == "data"
		and (path/"anim"):is_dir()
		and (path/"bigportraits"):is_dir()
		and (path/"images"):is_dir()
		and (path/"minimap"):is_dir() then
		return path
	end

	local name = path:name()
	if PLATFORM == "MACOS" then
		if path:is_dir() then
            if name == "Don't Starve Together" then
                return self:ResolvePath(path/"dontstarve_steam.app")
            elseif name == "Don't Starve Together Dedicated Server" then
                return self:ResolvePath(path/"dontstarve_dedicated_server_nullrenderer.app")
            elseif name == "dontstarve_steam.app" or name == "dontstarve_dedicated_server_nullrenderer.app" then
                return self:ResolvePath(path/"Contents"/"data")
            elseif name == "Contents" and path:parent():is_dir() then
                return self:ResolvePath(path:parent())
            end
        end
    elseif PLATFORM == "WINDOWS" then
    	if path.is_dir() then
            if name == "Don't Starve Together" or name == "Don't Starve Together Dedicated Server" then
                return self:ResolvePath(path/"data")
            elseif name:find("(2000004)") then
                return self:ResolvePath(path/"data")
            end
        elseif path:is_file() then
            if path:check_extention(".exe") and path:parent():name():startswith("bin")
            	and (name:find("dontstarve_steam") or name:find("dontstarve_rail"))then
            	return self:ResolvePath(path:parent():parent())
            end
        end
    elseif PLATFORM == "LINUX" then
    	-- TODO
    end
end

-- set the root if the path is a valid dst `data` folder
-- return `true` on success
function DST_DataRoot:SetRoot(path)
	if type(path) == "string" then
		path = FileSystem.Path(path)
	end
	local path = self:ResolvePath(path)
	if path == nil then
		return false
	end
	if path == self.root then
		return true
	end

	self.root = path
	print("Set game root: ", path)
	self:DropDatabundles()
	local databundles = self.root/"databundles"
	if databundles:is_dir() then
		for _, k in ipairs{"images", "bigportraits", "anim_dynamic", "scripts"}do
			local zippath = databundles/(k..".zip")
			local fs = zippath:is_file() and FileSystem.CreateReader(zippath)
			if fs then
				local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ALL_LAZY)
				if not zip.error then
					self.databundles[k:gsub("_", "/").."/"] = zip
				end
				zip:Close()
			end
		end
	end

	Config:SetAndSave("last_dst_root", self.root:as_string())
end

function DST_DataRoot:SearchGame()
	if PLATFORM == "WINDOWS" then
		for i = 2, 25 do
			local drive = FileSystem.Path(string.char(65 + i) .. ":/")
			print(drive)
			if drive:is_dir() then
				-- TODO
				error("unimplement!")
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
		-- 
	end
end

function DST_DataRoot:Open(path, bundled)
	if self.root then
		if bundled ~= false then
			-- search databundles
			for k,v in pairs(self.databundles)do
				if path:startswith(k) then
					local bytes = v:Get(path)
					local fs = bytes and CreateBytesReader(bytes)
					if fs ~= nil then
						return fs
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
		if bundled ~= false then
			for k,v in pairs(self.databundles)do
				if path:startswith(k) and v:Get(path) ~= nil then
					return true
				end
			end
		end
		return (self.root/path):is_file()
	end
end

function DST_DataRoot:DropDatabundles()
	-- for k,v in pairs(self.databundles)do
	-- 	v:Close()
	-- end
end

function DST_DataRoot:__div(path)
	return self.root/path
end

Root = DST_DataRoot("/Users/wzh/DST/dontstarve_dedicated_server_nullrenderer.app/Contents/data/")

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

	self.allzipfilepath = {}
	self.alldynfilepath = {}
	self.allxmlfilepath = {}
	self.alltexelements = {}
	self.allfevfilepath = {}

	self.loaders = {
		xml = {},
		tex = {},
		atlas = {},
	}

	self.static = static
	-- self:ListAsset()

	if not self.static then
		self.index = AssetIndex(root)
	end
end)

-- function Provider:ListAsset()
	-- (self.root/"anim"):iter

function Provider:Fetch(type, args)
	if type == "build" then
		return self:GetBuild(args)
	elseif type == "animation" then
		return self:GetAnimation(args)
	elseif type == "atlas" then
		return self:GetAtlas(args)
	elseif type == "image" then
		return self:GetImage(args)
	elseif type == "show" then
		--
	end
end

function Provider:GetBuild(args)
	if type(args.name) == "string" then
		local path = self.index:GetBuildFile(args.name)
		local build = path and self:LoadBuild(path)
		return build and build.builddata
	end
end

-- TODO: add lru_cache 
function Provider:LoadBuild(path)
	local fs = self.root:Open(path)
	if fs ~= nil then
		local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.BUILD)
		if not zip.error then
			local build_raw = zip:Get("build.bin")
			local build = build_raw and BuildLoader(CreateBytesReader(build_raw))
			if build and not build.error then
				return build
			end
		end
	end
end

function Provider:GetAnimation(args)
	if type(args.name) == "string" and 
		(type(args.bank) == "string" or type(args.bank) == "number") then
		-- convert to number
		local bank = type(args.bank) == "string" and Algorithm.SmallHash_Impl(args.bank) or args.bank 
		local paths = self.index:GetAnimFileList(bank, args.name)
		if paths then
			local result = {}
			for k in pairs(paths) do
				local anim = self:LoadAnim(k)
				for _,v in ipairs(anim.animlist)do
					if v.name == args.name and v.bankhash == bank then
						table.insert(result, v) -- TODO: v.assetpath ?
					end
				end
			end
			return result
		end
	end
end

function Provider:LoadAnim(path)
	local fs = self.root:Open(path)
	if fs ~= nil then
		local zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ANIM)
		if not zip.error then
			local anim_raw = zip:Get("anim.bin")
			local anim = anim_raw and AnimLoader(CreateBytesReader(anim_raw))
			if anim and not anim.error then
				return anim
			end
		end
	end
end

function Provider:GetAtlas(args)
	if type(args.name) == "string" then
		if args.n == nil then
			args.n = 0 -- note: atlas sampler index starts at 0
		end
		if type(args.n) ~= "number" then
			return
		end

		local atlaslist = self:LoadAtlas(args.name)
		if atlaslist then
			local atlas = atlaslist[args.n]
			if atlas ~= nil then
				local w, h = atlas:GetSize()
				local index = CalcIndex(w, h, args)
				if args.format == "rgba" then
					return { width = w, height = h, bytes = atlas:GetImageBytes(index) }
				elseif args.format == "img" then
					return atlas:GetImage(index)
				elseif args.format == "png" then
					return atlas:GetImage(index):save_png_bytes()
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
	if build ~= nil then
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
		end
		local sig = fs:read_exact(6) or ""
		local zip = nil
		fs:rewind()
		if sig:startswith(ZIP_SIG) then
			zip = ZipLoader(fs, ZipLoader.NAME_FILTER.ALL)
		elseif sig == DYN_SIG then
			zip = DynLoader(fs)
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
					atlaslist[i - 1] = tex
				end
			end
		end
		return atlaslist
	end
end

function Provider:GetImage(args)
	if type(args.xml) == "string" and type(args.tex) == "string" and type(args.format) == "string" then
		local xml = self:LoadXml(args.xml)
		if xml ~= nil then
			table.foreach(xml.imgs, print)
			local info = xml:Get(args.tex)
			if info == nil then
				if args.tex:startswith("@ATLAS") then
					info = {u1 = 0, u2 = 1, v1 = 0, v2 = 1}
				else
					return
				end
			end
			local u1, u2, v1, v2 = info.u1, info.u2, info.v1, info.v2
			local tex = xml.tex
			local _, _, parent = string.find(args.xml, "^(.*/)[^/]+$")
			if parent == nil then
				error("Failed to get parent path of: "..xml.tex)
			end
			local tex = self:LoadTex(parent..tex)
			if tex ~= nil then
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
				end
			end
		end
	end
end


function Provider:LoadXml(path)
	if self.loaders.xml[path] ~= nil then
		return self.loaders.xml[path]
	end

	local fs = self.root:Open(path)
	if fs ~= nil then
		local xml = XmlLoader(fs)
		if not xml.error then
			self.loaders.xml[path] = xml
			return xml
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




local p = Provider(Root)
print(p:GetBuild({name="pig_build"}))
print(p:GetBuild({name="wolfgang_ice"}))
-- print(json.encode(p:GetAnimation{bank = "wilson", name = "idle_+loop"}))
timeit(1)
-- print(#p:GetImage{xml = "bigportraits/wilson_none.xml", tex = "wilson_none_oval.tex", format = "rgba"})
-- print(#p:GetImage{xml = "bigportraits/wilson_none.xml", tex = "@ATLAS-.tex", format = "rgba"})
print(p:GetAtlas{name="wilson", n=0})
print(FileSystem.SaveString("1.png", p:GetAtlas{name="wilson_ice", n=0, format="png"}))
timeit()


