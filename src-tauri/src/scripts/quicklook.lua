-- asset file opener

local MB = 1024 * 1024

QuickLook = Class(function(self, f)
	assert(f ~= nil)
	local head = f:read_string(4) or ""
	local extra = f:read(100) or ""
	local perfer_bin = self.ext == nil or table.contains({"png", "tex", "bin", "zip", "dyn", "fev", "fsb", "obj", "ksh"}, self.ext)
	local prefer_txt = table.contains({"txt", "lua", "json", "xml", "csv", "html", "htm", "md", "rst", "ps", "vs", "scml"}, self.ext)
	local check_txt = is_utf8_lossy(head..extra)

	local function error(e)
		self.error = e
		funcprint("Error in looking file: "..tostring(path))
	end

	f:rewind()

	if prefer_txt and check_txt then
		if self.ext == "xml" then
			self:LoadAsXml(f, error)
		else
			self:LoadAsRawText(f, error)
		end
	elseif perfer_bin then
		if head == TEX_SIG then
			self:LoadAsTex(f, error)
		elseif head == ANIM_SIG then
			self:LoadAsAnim(f, error)
		elseif head == BUILD_SIG then
			self:LoadAsBuild(f, error)
		elseif head == ZIP_SIG then
			self:LoadAsZip(f, error)
		elseif head == DYN_SIG then
			self:LoadAsDyn(f, error)
		end

		f:seek_to(4000000000)
		local size = f:tell()
		local mtime = -1
		if self.path ~= nil then
			mtime = self.path:mtime()
		end
		table.insert(self.data, { type = "meta", size = size, mtime = mtime })
	end

end)

function QuickLook:LoadAsXml(f, error)
	self:LoadAsRawText(f, error)
	local xml = XmlLoader(f)
	if xml.error then
		error(xml.error)
		table.insert(self.data, { type = "xml", success = false, error = xml.error })
	else
		table.insert(self.data, { type = "xml", success = true, xml = xml })
		-- try to load tex
		local inst2 = self:TryToOpen(xml.texname)
		if inst2 == nil then
			table.insert(self.data, { type = "ref:tex", exists = false })
		else
			table.insert(self.data, { type = "ref:tex", exists = true, name = xml.texname, path = inst2:GetPath(),
				error = inst2.error, data = inst2.data })
		end
	end
	f:close()
end

function QuickLook:LoadAsRawText(f, error)
	local content = f:read_to_end()
	table.insert(self.data, {
		type = "raw_text",
		success = true,
		is_utf8 = string.is_utf8(content),
		content = content,
	})
end

function QuickLook:LoadAsTex(f, error)
	local tex = TexLoader(f)
	local format = tex:GetPixelFormatString()
	if tex.error then
		error(tex.error)
		table.insert(self.data, { type = "tex", success = false, error = tex.error, format = format })
	else
		local w, h = tex:GetSize()
		local bytes = tex:GetImageBytes(w, h)
		table.insert(self.data, { type = "tex", success = true, width = w, height = h, bytes = bytes, format = format })
	end
	f:close()
end

function QuickLook:LoadAsAnim(f, error)
	local anim = AnimLoader(f)
	if anim.error then
		error(anim.error)
		table.insert(self.data, { type = "anim", error = anim.error} )
	else
		table.insert(self.data, { type = "anim", animlist = anim:GetAnimList() })
	end
end

function QuickLook:LoadAsBuild(f, error)
	local build = BuildLoader(f)
	if build.error then
		error(build.error)
		table.insert(self.data, { type = "build", error = build.error })
	else
		-- >
		table.insert(self.data, { type = "build", error = "unimplemented"} )
		for _, name in ipairs(build.atlaslist)do
			local inst2 = self:TryToOpen(name)
			if inst2 == nil then
				table.insert(self.data, { type = "ref:tex", exists = false })
			else
				table.insert(self.data, { type = "ref:tex", exists = true, path = inst2:GetPath(), name = name, 
					error = inst2.error, data = inst2.data })
			end
		end
	end
end

function QuickLook:LoadAsZip(f, error)
	local zip = ZipLoader(f, ZipLoader.NAME_FILTER.ALL_LAZY)
	if zip.error then
		error(zip.error)
		table.insert(self.data, { type = "zip", error = zip.error })
	else
		local namelist = zip:List()
		local children = {}
		table.insert(self.data, { type = "zip", success = true, namelist = namelist, children = children })
		-- iter all files
		if not self:IsZipped() then
			for _, name in ipairs(namelist)do
				local size = zip:GetRawSize(name)
				if size == nil then
					table.insert(children, { name = name, size = -1 })
				elseif size > 100 * MB then
					table.insert(children, { name = name, size = size })
				else
					local content = assert(zip:Get(name), "Cannot extract zip file: "..name)
					local inst2 = QuickLook.Zipped(name, content, zip)
					table.insert(children, { name = name, size = size, error = inst2.error, data = inst2.data})
				end
			end
		end
	end
end

function QuickLook:GetPath()
	if self.path ~= nil then
		return self.path:as_string()
	else
		return "" -- in zipfile
	end
end

function QuickLook:Serialize()
	return json.encode({
		path = self:GetPath(),
		name = self.name,
		ext  = self.ext,
		data = self.data,
	})
end

QuickLook.File = Class(QuickLook, function(self, path)
	self.path = path
	self.name = self.path:name()
	self.parent_dir = self.path:parent()
	self.ext = ExtOf(self.name)
	if self.ext ~= nil then
		self.ext = string.lower(self.ext)
	end

	makereadonly(self, "path")
	makereadonly(self, "name")
	makereadonly(self, "parent_dir")
	makereadonly(self, "ext")
	QuickLook._ctor(self)
end)

QuickLook.Zipped = Class(QuickLook, function(self, name, decompressed_bytes, zip)
	self.path = nil
	self.parent_dir = nil
	self.name = name
	self.zip = zip

	self.ext = ExtOf(self.name)
	if self.ext ~= nil then
		self.ext = string.lower(self.ext)
	end

	makereadonly(self, "path")
	makereadonly(self, "parent_dir")
	makereadonly(self, "name")
	makereadonly(self, "zip")
	makereadonly(self, "ext")
	QuickLook._ctor(self)
end)

function QuickLook:IsZipped()
	return self.zip ~= nil
end

function QuickLook:TryToOpen(name)
	if self.zip ~= nil then
		local content = self.zip:Get(name)
		if content ~= nil then
			return QuickLook.Zipped(name, content, self.zip)
		end
	else
		local path = self.parent_dir:with_name(name)
		if path:parent_dir() == self.parent_dir and path:is_file() then
			return QuickLook.File(path)
		end
	end
end

function is_utf8(str)
    local byte = string.byte
    local len = #str
    local i = 1
    
    while i <= len do
        local c = byte(str, i)
        
        if c >= 0 and c <= 127 then
        	if c == 0 then
        		return false, i
        	end
            i = i + 1
        elseif c >= 192 and c <= 223 then
            if i + 1 > len or byte(str, i + 1) < 128 or byte(str, i + 1) > 191 then
                return false, i
            end
            i = i + 2
        elseif c >= 224 and c <= 239 then
            if i + 2 > len or byte(str, i + 1) < 128 or byte(str, i + 1) > 191 or
               byte(str, i + 2) < 128 or byte(str, i + 2) > 191 then
                return false, i
            end
            i = i + 3
        elseif c >= 240 and c <= 247 then
            if i + 3 > len or byte(str, i + 1) < 128 or byte(str, i + 1) > 191 or
               byte(str, i + 2) < 128 or byte(str, i + 2) > 191 or
               byte(str, i + 3) < 128 or byte(str, i + 3) > 191 then
                return false, i
            end
            i = i + 4
        else
            return false, i
        end
    end
    
    return true
end

function is_utf8_lossy(str)
	-- check utf8 string, ignore last trimmed bytes
	local check, last_index = is_valid_utf8(str)
	if check or #str - last_index < 4 then
		return true
	else
		return false
	end
end

do return end
local DEBUG_ZipLoader = Class(function(self, f, name_filter)
	
    self.contents = {}

    local function error(e)
        self.error = e
        funcprint("Error in ZipLoader._ctor(): "..e)
        f:close()
    end

    self.name_pos = {}

    while f:seek_to_string(ZIP_SIG) do
        f:seek_forward(4)
        local method = f:read_u16()
        if method == nil then
            return error(ERROR.UNEXPECTED_EOF)
        elseif method == 1 then
            method = "stored"
        elseif method == 8 then
            method = "deflated"
        else
            return error(ERROR.UNSUPPORTED_ZIP_COMPRESS_METHOD)
        end
        local mtime = f:read_u32() -- 4 bytes
        local crc = f:read_u32()
        local compressed_len = f:read_u32()
        local raw_len = f:read_u32()
        local name_len = f:read_u16()
        local extra_len = f:read_u16()

        if extra_len == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end

        local name_pos = f:tell()
        table.insert(self.name_pos, {name_pos, name_len})
        local name = f:read_string(name_len)
        local data_starts = f:tell()

        f:seek_forward(compressed_len)
    end
    
    -- f:close()

    -- writeout
    -- only change name by name_pos
   	f:rewind()
   	local content = ""
   	for _,v in ipairs(self.name_pos)do
   		local pos, name_len = unpack(v)
   		local current = f:tell()
   		content  =content .. f:read(pos - current)
   		f:read(name_len)
   		content = content .. string.rep("\0", name_len)
	end
	content = content .. f:read_to_end() 


    Path("/Users/wzh/sourcecode/rust-learn/gui/Asset Archive/ttttt222.zip"):write(content)
end)

local z = DEBUG_ZipLoader(FileSystem.CreateReader("/Users/wzh/sourcecode/rust-learn/gui/Asset Archive/ttttt-1.zip"))
print(json.encode(z.name_pos))

exit()