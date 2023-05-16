local DST_DataRoot = Class(function(self, suggested_root)
	self.game = "DST"
	self.databundles = {}

	if suggested_root ~= nil and self:SetRoot(suggested_root) then
		return
	end

	-- if -- get config of last path

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
	if path == self.root then
		return true
	end

	self.root = path
	print("Set game root: "..path)
end

function DST_DataRoot:SearchGame()
	for i = 2, 25 do
		local drive = FileSystem.Path(string.char(65 + i) .. ":/")
		print(drive)
		if drive:is_dir() then
			--
		end
	end
end

DST_DataRoot.SearchGame()
