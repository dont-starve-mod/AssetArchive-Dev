local smallhash = Algorithm.SmallHash_Impl

Asset = Class(function(self, type, data)
	self.type = type
	for k,v in pairs(data)do
		self[k] = v
	end
	if type:lower() == type then
		self.id = self:GetID()
	end
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

function Asset.FromGame(type, file)
	type = type:gsub("DYNAMIC_", "")
	if type == "SCRIPT" or type == "IMAGE" or type == "Image" then
		return
	end
	if type == "PKGREF" and file:startswith("movies/") then
		return
	end
	if type == "PKGREF" or type == "ASSET_PKGREF" then
		if file:endswith(".tex") then
			return
		elseif file:endswith(".bin") then
			return
		end
	end
	if (type == "ANIM" or type == "PKGREF") and file:endswith(".zip") then
		return Asset("animzip", { file = file })
	end
	if type == "PKGREF" and file:endswith(".dyn") then
		return Asset("animdyn", { file = file })
	end
	if type == "INV_IMAGE" or type == "MINIMAP_IMAGE" then
		return Asset(type, { file = file })
	end
	if (type == "ATLAS" or type == "ATLAS_BUILD" or type == "FILE") and file:endswith(".xml") then
		return Asset("xml", { file = file })
	end
	if type == "SOUND" or type == "SHADER" or type == "PKGREF" and file:endswith(".fsb") then
		return
	end

			-- elif type == "SOUND":
		-- 	# 暂时忽略，以后要加上
		-- 	return None
		-- elif type == "PKGREF" and file.endswith(".fsb"):
		-- 	# 暂时忽略，以后要加上
		-- 	return None
		-- elif type == "SHADER" and file.endswith(".ksh"):
		-- 	# 暂时忽略，以后的以后再加上
		-- 	return None

	print_error("无法解析的Asset: ", type, file)
	-- body
end


Asset.ID_TYPES = {
	animzip = "z",
	animdyn = "d",
	xml = "x",
	tex = "t",
	sound = "s",
	tex_no_ref = "n"
}

function TexElementIdGetter(xml)
	local xml_hash = smallhash(xml)
	return function(tex)
		return "t-"..smallhash(tex).."-"..xml_hash
	end
end

