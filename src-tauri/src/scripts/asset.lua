local smallhash = Algorithm.SmallHash_Impl

Asset = Class(function(self, type, data)
	self.type = type
	for k,v in pairs(data)do
		self[k] = v
	end
	self.id = self:GetID()
end)

function Asset:__newindex(k,v)
	assert(type(k) == "string")
	if k:sub(1,1) ~= "_" and self.id ~= nil then
		error("Cannot set props after id has been calculated (readonly)")
	end
	rawset(self, k,v)
end

function Asset:__tostring()
	return string.format("Asset<%s %s>",
		self.type, self.file or self.xml)
end

function Asset:GetID()
	local id = assert(Asset.ID_TYPES[self.type], self.type)
	local temp = {}
	for k,v in pairs(self)do
		if k ~= "type" and k:sub(1, 1) ~= "_" then
			assert(type(v) == "string")
			table.insert(temp, {k, v})
		end
	end
	table.sort(temp, function(a, b) return a[1] < b[1] end)
	for _,v in ipairs(temp)do
		id = id.."-"..smallhash(v[2])
	end
	return id
end

Asset.ID_TYPES = {
	animzip = "z",
	animdyn = "d",
	xml = "x",
	tex = "t",
	sound = "s",
}

function TexElementIdGetter(xml)
	local xml_hash = smallhash(xml)
	return function(tex)
		return "t-"..smallhash(tex).."-"..xml_hash
	end
end

