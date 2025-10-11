local CreateBytesReader = FileSystem.CreateBytesReader

local function LoadModAsset(path, from)
	local ext = ExtOf(path)
	if ext == "zip" then
		local zip = ZipLoader2.Open(path)
		if zip.error then
			return { error = zip.error }
		else
			local anim = zip:Get("anim.bin")
			local build = zip:Get("build.bin")
			local data = {}
			if anim ~= nil then
				local anim = AnimLoader(CreateBytesReader(anim))
				if anim.error then
					data.anim = { error = anim.error }
				else
					data.anim = { anim_list = anim:GetAnimList() }
				end
			end
			if build ~= nil then
				local build = BuildLoader(CreateBytesReader(build), false, true)
				if build.error then
					data.build = { error = build.error }
				else
					if from == "renderer" then
						data.build = build -- this is json invalid
					else
						data.build = { build_data = build.builddata }
					end
				end
			end
			return data
		end
	elseif ext == "bin" then
		local sig = FileSystem.SigOf(path, 4)
		local f = FileSystem.CreateReader(path)
		if f == nil then
			return { error = "Failed to open file" }
		end
		if sig == ANIM_SIG then
			local anim = AnimLoader(f)
			if anim.error then
				return { error = anim.error }
			else
				return { anim = { anim_list = anim:GetAnimList() } }
			end
		elseif sig == BUILD_SIG then
			local build = BuildLoader(f)
			if build.error then
				return { error = build.error }
			else
				if from == "renderer" then
					return { build = build }
				else
					return { build = { build_data = build.builddata } }
				end
			end
		else
			return { error = "Invalid file type" }
		end
	end

	return { error = "Invalid file type" }
end

IpcHandlers.Register("load_mod_anim_assets", function(path_list)
	local result = {}
	for _, v in ipairs(path_list)do
		local data = LoadModAsset(v)
		data.path = v
		result[v] = data
	end
	return result
end)

return {
	LoadModAsset = LoadModAsset,
}