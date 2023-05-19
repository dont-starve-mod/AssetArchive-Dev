-- Lua FileSystem {
--   GetString(path: string, content: string | nil) -> string | nil
--     get string from a file, relative to `APP_DATA_DIR`,
--     absolute path is not allowed,
--     if `content` is nil, file will be removed
--  
--   SaveString(path: string) -> bool
--     override string to a file, relative to `APP_DATA_DIR`,
--     absolute path is not allowed
-- }

local GetString = FileSystem.GetString
local SaveString = FileSystem.SaveString

local LocalStorage = Class(function(self, _type, filepath)
	self.type = _type
	self.filepath = string.format(filepath or "%s.json", self.type)
	self.data = {}
	self.dirty = false
	
	local _, data = pcall(json.decode, GetString(self.filepath))
	if type(data) == "table" then
		self.data = data
	end
end)

function LocalStorage:Set(k,v)
	self.data[k] = v
	self.dirty = true
end

function LocalStorage:Get(k)
	return self.data[k]
end

function LocalStorage:Save()
	if self.dirty then
		if not SaveString(self.filepath, json.encode(self.data)) then
			print("Warning: Failed to save: "..self.filepath)
		end
		self.dirty = false
	end
end

function LocalStorage:SetAndSave(k,v)
	self:Set(k,v)
	self:Save()
end

function LocalStorage:Update(t)
	for k,v in pairs(t)do
		self.data[k] = v
	end
	self.dirty = true
	return self
end

function LocalStorage:__tostring()
	return string.format("LocalStorage<%s>", self.type)
end

Persistant = {
	IndexCache = LocalStorage("index-v0"),
	Config = LocalStorage("config-v0"),
	Hash = LocalStorage("hash-v0"),
}
