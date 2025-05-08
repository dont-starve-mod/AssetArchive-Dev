-- asset file viewer
local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local GetFileSize = FileSystem.GetFileSize
local GetMTime = FileSystem.GetMTime
local WithFileName = FileSystem.WithFileName
local MB = 1024 * 1024

local function LoadAsXml(f, data)
	local xml = XmlLoader(f)
	if xml.error then
		table.insert(data, { type = "xml", error = xml.error })
	else
		local texname = xml.texname
		local imgs = xml.imgs
		-- TODO: what if textname / imgs contains invalid characters?
		table.insert(data, { type = "xml", texname = texname, imgs = imgs })
	end
end

local function LoadAsTex(f, data)
	local tex = TexLoader(f)
	local format = tex:GetPixelFormatString()
	if tex.error then
		table.insert(data, { type = "tex", error = tex.error, format = format })
	else
		local w, h = tex:GetSize()
		local bytes = tex:GetImageBytes(0)
		bytes = Image.ToRGBA(bytes, w, h)
		table.insert(data, { type = "tex", img_json = Image.EncodeJson(bytes, w, h), format = format })
	end
end

local function LoadAsAnim(f, data)
	local anim = AnimLoader(f)
	if anim.error then
		table.insert(data, { type = "anim", error = anim.error} )
	else
		table.insert(data, { type = "anim", animlist = anim:GetAnimList() })
	end
end

local function LoadAsBuild(f, data)
	local build = BuildLoader(f)
	if build.error then
		table.insert(data, { type = "build", error = build.error })
	else
		local invalid_utf8 = build.invalid_utf8
		local name = build.builddata.name_utf8
		local atlas = build.builddata.atlas_utf8
		local symbol = build.builddata.symbol
		table.insert(data, { type = "build", invalid_utf8 = invalid_utf8, name = name, atlas = atlas, symbol = symbol})
	end
end

local function LoadAsDyn(f, data)
	local dyn = DynLoader(f)
	if dyn.error then
		table.insert(data, { type = "dyn", error = dyn.error })
	else
		for _,k in ipairs(dyn:List())do
			local f = FileSystem.CreateBytesReader(dyn:Get(k))
			local tex = TexLoader(f)
			if tex.error then
				table.insert(data, {type = "ref_atlas", atlas_name = k, error = tex.error})
			else
				local w, h = tex:GetSize()
				local bytes = tex:GetImageBytes(0)
				local format = tex:GetPixelFormatString()
				bytes = Image.ToRGBA(bytes, w, h)
				table.insert(data, {type = "ref_atlas", atlas_name = k, img_json = Image.EncodeJson(bytes, w, h), format = format})
			end
		end
	end
end

local function LoadAsFev(_, data, filepath)
	local fev = Fev.Open(filepath)
	if fev.error then
		table.insert(data, { type = "fev", error = fev.error })
	else
		table.insert(data, { type = "fev", proj_name = fev.proj_name, event_path_list = fev.inner:event_path_list() })
	end
end

local function LoadAsFsb(f, data, filepath)
	local fsb = FsbLoader(f)
	if fsb.error then
		table.insert(data, { type = "fsb", error = fsb.error })
	else
		table.insert(data, { type = "fsb", format = fsb.format, sample_list = fsb.sample_list })
	end
end

local function LoadAsZip(_, data, filepath)
	-- 1. generic zip file (file tree)
	-- 2. anim zip
	--   special cases: character/weapon/hat/backpack/wilson_animation
	-- 3. font TODO:
	local zip = ZipLoader2.Open(filepath)
	if zip.error then
		table.insert(data, { type = "zip", error = zip.error })
	else
		local name_list = zip:List()
		table.insert(data, { type = "zip", name_list = name_list })
		local anim = zip:Get("anim.bin")
		local build = zip:Get("build.bin")
		if anim then
			LoadAsAnim(CreateBytesReader(anim), data)
		end
		if build then
			LoadAsBuild(CreateBytesReader(build), data)
		end
		local build = data[#data]
		for i,atlas in ipairs(build.atlas or {})do
			if build.invalid_utf8 then
				table.insert(data, {type = "ref_atlas", atlas_index = i - 1, locked = true})
			else
				local tex = zip:Get(atlas)
				if tex ~= nil then
					local f = CreateBytesReader(tex)
					LoadAsTex(f, data)
					data[#data].type = "ref_atlas"
					data[#data].atlas_index = i - 1
					data[#data].atlas_name = atlas
				else
					table.insert(data, {type = "ref_atlas", atlas_index = i - 1, atlas_name = atlas, ref_missing = true})
				end
			end
		end
	end
end

local function LoadAsKsh(f, data)
	local ksh = KshLoader(f)
	if ksh.error then
		table.insert(data, { type = "ksh", error = ksh.error })
	else
		table.insert(data, { type = "ksh", ps_name = ksh.ps_name, vs_name = ksh.vs_name,
			ps = ksh.ps, vs = ksh.vs })
	end
end

-- ipc handler
IpcHandlers.Register("quicklook_load", function(param)
	local filepath = param.filepath
	print("[QUICKLOOK] filepath = "..filepath)
	local ext = ExtOf(filepath)
	local load_as = param.load_as -- xml / tex / build / anim / zip / dyn
	if load_as == nil then
		-- guess from extension
		if ext == "xml" or ext == "tex" or ext == "dyn" or ext == "zip"
			or ext == "fev" or ext == "fsb" or ext == "ksh" then
			load_as = ext
		elseif ext == "bin" then
			local sig = FileSystem.SigOf(filepath, 4)
			if sig == ANIM_SIG then
				load_as = "anim"
			elseif sig == BUILD_SIG then
				load_as = "build"
			else
				load_as = "raw_bin"
			end
		elseif ext == "html" or ext == "htm" or ext == "txt" or ext == "ps" or ext == "vs" 
			or ext == "lua" or ext == "py" or ext == "json" or ext == "scml"
			then
			load_as = "raw_txt"
		elseif ext == "png" or ext == "jpg" or ext == "jpeg" or ext == "gif" then
			load_as = "raw_image"
		else
			local head = FileSystem.SigOf(filepath, 1000)
		 	if #head - string.get_utf8_last_valid_index(head) < 5 then
				load_as = "raw_txt"
			else
				load_as = "raw_bin"
			end
		end
	end

	print("[QUICKLOOK] load_as = "..load_as)
	local data = {}
	local f = CreateReader(filepath)
	if f == nil then
		table.insert(data, {type = "loader", error = "Failed to open file"})
		return data
	end

	if load_as == "tex" then
		LoadAsTex(f, data)
	elseif load_as == "xml" then
		LoadAsXml(f, data)
		local xml = data[#data]
		if xml.texname ~= nil then
			local texpath = FileSystem.WithFileName(filepath, xml.texname)
			local f = FileSystem.CreateReader(texpath)
			if f ~= nil then
				LoadAsTex(f, data)
				data[#data].type = "ref_tex"
				data[#data].name = xml.texname
			end
		end
	elseif load_as == "anim" then
		LoadAsAnim(f, data)
	elseif load_as == "build" then
		LoadAsBuild(f, data)
		local build = data[#data]
		for i,atlas in ipairs(build.atlas or {})do
			if build.invalid_utf8 then
				table.insert(data, {type = "ref_atlas", atlas_index = i - 1, locked = true})
			else
				local texpath = FileSystem.WithFileName(filepath, atlas)
				local f = FileSystem.CreateReader(texpath)
				if f ~= nil then
					LoadAsTex(f, data)
					data[#data].type = "ref_atlas"
					data[#data].atlas_index = i - 1
					data[#data].atlas_name = atlas
				else
					table.insert(data, {type = "ref_atlas", atlas_index = i - 1, atlas_name = atlas, ref_missing = true})
				end
			end
		end
	elseif load_as == "zip" then
		LoadAsZip(f, data, filepath)
	elseif load_as == "ksh" then
		LoadAsKsh(f, data)
	elseif load_as == "fev" then
		LoadAsFev(f, data, filepath)
	elseif load_as == "fsb" then
		LoadAsFsb(f, data, filepath)
	elseif load_as == "dyn" then
		LoadAsDyn(f, data)
	elseif load_as == "raw_txt" or load_as == "raw_image" or load_as == "raw_bin" then
		local threshold = load_as == "raw_image" and 100 or 10
		local content = f:read(threshold * MB)
		if load_as == "raw_bin" then
			content = PPrintAsHex(content)
		else
			content = Algorithm.B64Encode(content)
		end
		local large_file = f:read(1) ~= nil
		table.insert(data, { type = load_as, content = content, large_file_threshold = large_file and threshold or nil })
	else
		print("Warning: load_as is not handled: "..load_as)
	end

	f:close()

	-- Core_AllowFile(filepath)
	print("data: ["..#data.."]")

	return data
end)
