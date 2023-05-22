Asset = Class(function(self, type, data)
	self.type = type
	self.data = {}
	for k,v in pairs(data)do
		self.data[k] = v
	end
end)