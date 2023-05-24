local smallhash = Algorithm.SmallHash_Impl

Asset = Class(function(self, type, data)
	self.type = type
	for k,v in pairs(data)do
		self[k] = v
	end
end)

function Asset:__tostring()
	return string.format("Asset<%s %s>",
		self.type, self.file or self.xml)
end