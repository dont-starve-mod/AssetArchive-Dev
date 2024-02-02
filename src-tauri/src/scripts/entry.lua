Entry = Class(function(self, data)
	self.key = data.key or nil -- unique key of entry, use ascii string (like prefab name)

	self.alias = data.alias or {}   -- list of names (string)
	self.desc = data.desc or {}     -- list of descrptions (richtext[])
	self.assets = data.assets or {} -- list of relative assets
	self.deps = data.deps or {}     -- list of relative prefabs/entries
	self.source = data.source or {} -- list of source file
end)

function Entry:SetKey(key)
	assert(type(key) == "string")
	assert(key:match("[a-zA-Z0-9%_%-]+"), "Invalid key content, must use a-z, A-Z, 0-9, - and _")
	assert(self.key == nil)
	self.key = key
end