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
		if not SaveString(self.filepath, json.encode_compliant(self.data)) then
			print("Warning: Failed to save: "..self.filepath)
		end
		self.dirty = false
	end
end

function LocalStorage:SetAndSave(k,v)
	self:Set(k,v)
	self:Save()
end

function LocalStorage:Dumps()
	return json.encode_compliant(self.data)
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

-- validate config key - value
local CONFIG_DEF = {
	colortheme = {type = "string", choices = {"auto", "light", "dark"}},
	resolution = {type = "string", choices = {"full", "half"}},
	volume = {type = "number", default = 100},

	last_dst_root = {type = "string"}
}
local config = Persistant.Config.data
for k,v in pairs(CONFIG_DEF)do
	if config[k] == nil then
		if v.choices then
			config[k] = v.choices[1] -- as default
		elseif v.default then
			config[k] = v.default
		end
	elseif type(config[k]) ~= v.type or v.choices ~= nil and not table.contains(v.choices, config[k]) then
		print("Warning: config failed to validate: "..k.." -> "..tostring(v))
		config[k] = v.choices and v.choices[1] or nil
	end
end

-- inform frontend when config change
local old_Set = Persistant.Config.Set
Persistant.Config.Set = function(self, k, v)
	old_Set(self, k, v)
	pcall(IpcEmitEvent, "updateconfig", json.encode_compliant({key = k, value = v}))
end
