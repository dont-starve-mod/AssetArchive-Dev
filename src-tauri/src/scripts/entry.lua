Entry = Class(function(self, data)
	self.key = data.key or nil

	self.alias = data.alias or {}
	self.abstract = data.abstract or {}
	self.source = data.source or {}
	self.deps = data.deps or {}
	self.assets = data.assets or {}
end)

function Entry:SetKey(k)
	assert(k)
	assert(self.key == nil)
	self.key = k
end


