local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local Config = Persistant.Config

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
