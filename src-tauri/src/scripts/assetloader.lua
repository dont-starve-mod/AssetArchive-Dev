local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local Deflate = Algorithm.Deflate
local DXT5_Decompress = Algorithm.DXT5_Decompress
local DXT1_Decompress = Algorithm.DXT1_Decompress
local FlipBytes = Algorithm.FlipBytes
local DivAlpha = Algorithm.DivAlpha
local CropBytes = Algorithm.CropBytes
local slaxdom = require "slaxdom"
local ZIP_SIG = ZIP_SIG
local DYN_SIG = DYN_SIG
local max = math.max
local min = math.min
local floor = math.floor

local function round2(n)
    local tail = n % 0.01
    return tail > 0.005 and n + 0.01 - tail or n - tail
end

local function average(t)
    local n = #t
    local sum = 0
    for _,v in ipairs(t)do
        sum = sum + v
    end
    return sum / n
end

local function median(t)
    local n = #t
    if n == 1 then
        return t[1]
    else
        return t[math.floor(n/2)]
    end
end

-- loader for <build.bin>
BuildLoader = Class(function(self, f, lazy)
    local function error(e)
        self.error = e
        funcprint("Error in BuildLoader._ctor(): "..e)
        f:close()
    end

    if f:read_string(4) ~= "BILD" then
        return error("BILD file sig not satisfied")
    end

    f:seek_forward(4)
    local numsymbols = f:read_u32()
    f:seek_forward(4)
    local name = f:read_variable_length_string()
    local numatlases = f:read_u32()
    if numatlases == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    self.buildname = name
    self.numatlases = numatlases
    self.atlas = {}
    self.lazy = lazy

    for i = 1, numatlases do
        local name = f:read_variable_length_string()
        if name ~= nil then
            table.insert(self.atlas, name)
        else
            return error(ERROR.UNEXPECTED_EOF)
        end
    end

    local allimgs = {}
    local symbol = {}
    local symbol_collection = {}
    for i = 1, numsymbols do
        local imghash = f:read_u32()
        local numimgs = f:read_u32()
        if numimgs == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end
        table.insert(symbol_collection, imghash)
        if lazy and imghash ~= self.SWAP_ICON then
            f:seek_forward(numimgs * 32)
        else
            local imgs = { imghash = imghash, imglist = {} }
            for j = 1, numimgs do
                local img = {
                    index = f:read_u32(),
                    duration = f:read_u32(),
                    x = f:read_f32(),
                    y = f:read_f32(),
                    w = f:read_f32(),
                    h = f:read_f32(),
                    vertexindex = f:read_u32(),
                    numvertexs = f:read_u32(),
                }
                if img.numvertexs == nil then
                    return error(ERROR.UNEXPECTED_EOF)
                end
                table.insert(imgs.imglist, img)
                table.insert(allimgs, img)
            end
            
            if imghash == SWAP_ICON then
                if #imgs.imglist >= 1 and imgs.imglist[1].index == 0 then
                    self.swap_icon_0 = imgs.imglist[1]
                else
                    print("Warning: failed to get first image from symbol `SWAP_ICON`")
                end
            end

            table.insert(symbol, imgs)
        end
    end

    local totalnumvertexs = f:read_u32()
    if totalnumvertexs == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    -- only parse swap_icon_0 in lazy mode
    if lazy then
        allimgs = { self.swap_icon_0 }
        if self.swap_icon_0 ~= nil then
            f:seek_forward(self.swap_icon_0.vertexindex* 24)
        end
    end

    for i, img in ipairs(allimgs) do
        if img.numvertexs == 0 then
            img.blank = true
        else
            local x, y, w, h = img.x, img.y, img.w, img.h
            local x_offset, y_offset = x - w/2, y - h/2

            local temp = {
                sampler = {},       -- index of texture (atlas-0.tex -> 0)
                bbx = {}, bby = {}, -- bbox left-top coord
                cw =  {}, ch =  {}, -- normalized canvas size
            }

            for j = 1, img.numvertexs / 6 do
                -- sampler = data[5]  # 0,5 
                -- left    = data[0]  # 0,0 
                -- right   = data[6]  # 1,0 
                -- top     = data[1]  # 0,1 
                -- bottom  = data[13] # 2,1
                -- umin    = data[3]  # 0,3 
                -- umax    = data[9]  # 1,3 
                -- vmin    = data[4]  # 0,4 
                -- vmax    = data[16] # 2,4
                local left = f:read_f32()   -- 0
                local top = f:read_f32()    -- 1
                f:seek_forward(4)
                local umin = f:read_f32()   -- 3
                local vmin = f:read_f32()   -- 4
                local sampler = f:read_f32()-- 5
                local right = f:read_f32()  -- 6
                f:seek_forward(8)
                local umax = f:read_f32()   -- 9
                f:seek_forward(12)
                local bottom = f:read_f32() -- 13
                f:seek_forward(8)
                local vmax = f:read_f32()   -- 16
                f:seek_forward(19*4)

                local cw = (right - left) / max(umax - umin, .00001)
                local ch = (top - bottom) / min(vmax - vmin, -.00001)
                local bbx = umin * cw - (left - x_offset)
                local bby = (1-vmin) * ch - (top - y_offset)

                table.insert(temp.sampler, sampler)
                table.insert(temp.bbx, bbx)
                table.insert(temp.bby, bby)
                table.insert(temp.cw, cw)
                table.insert(temp.ch, ch)
            end

            img.sampler = math.floor(median(temp.sampler) + 0.5)
            img.bbx = round2(median(temp.bbx))
            img.bby = round2(median(temp.bby))
            img.cw = round2(median(temp.cw))
            img.ch = round2(median(temp.ch))

            if not lazy then
                img.vertexindex = nil
                img.numvertexs = nil
            end
        end
    end

    self.builddata = {name = name, atlas = self.atlas, symbol = symbol}
    self.symbol_map = {}
    self.symbol_collection = symbol_collection
    for _,v in ipairs(symbol)do
        self.symbol_map[v.imghash] = v
    end

    if lazy then
        if self.swap_icon_0 then
            f:seek_forward((totalnumvertexs - self.swap_icon_0.vertexindex - self.swap_icon_0.numvertexs)* 24)
            HashLib:ParseFile(f)
        end
    else
        HashLib:ParseFile(f)
    end

    f:close()
end)

BuildLoader.SWAP_ICON = SWAP_ICON

function BuildLoader:GetSymbol(hash)
    assert(not self.lazy, "Cannot get symbol from a lazy build loader, use `GetSwapIcon` instead")
    if type(hash) == "string" then
        hash = HashLib:String2Hash(hash)
    end
    return self.symbol_map[hash]
end

function BuildLoader:GetSwapIcon()
    if self.lazy then
        return self.swap_icon_0
    else
        local symbol = self:GetSymbol(self.SWAP_ICON)
        return symbol and symbol[1]
    end
end

-- loader for <anim.bin>
AnimLoader = Class(function(self, f)
    local function error(e)
        self.error = e
        funcprint("Error in AnimLoader._ctor(): "..e)
        f:close()
    end

    if f:read_string(4) ~= "ANIM" then
        return error("ANIM file sig not satisfied")
    end

    f:seek_forward(16)
    local numanims = f:read_u32()
    if numanims == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    local animlist = {}
    for i = 1, numanims do
        local name = f:read_variable_length_string()
        local facing = f:read_exact(1)
        local bankhash = f:read_u32()
        local framerate = f:read_f32()
        local numframes = f:read_u32()
        if numframes == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end

        local anim = {
            name = name,
            facing = string.byte(facing, 1),
            bankhash = bankhash,
            framerate = framerate,
            numframes = numframes,
        }
        local frame = {}

        for j = 1, numframes do
            f:seek_forward(16) -- rect (f32*4)
            local numevents = f:read_u32()
            if numevents == nil then
                return error(ERROR.UNEXPECTED_EOF)
            elseif numevents > 0 then
                f:seek_forward(numevents* 4)
            end
            local numelements = f:read_u32()
            if numelements == nil then
                return error(ERROR.UNEXPECTED_EOF)
            end
            local element = {
                raw = f:read_exact(numelements* 40)
            }
            table.insert(frame, element)
        end

        anim.frame = frame
        table.insert(animlist, anim)
    end

    self.animlist = animlist

    HashLib:ParseFile(f)

    f:close()
end)

function AnimLoader:ParseFrames(anim)
    for _, v in ipairs(anim.frame) do
        if v.raw ~= nil then
            local num = #v.raw/40
            local f = CreateBytesReader(v.raw)
            for i = 1, num do
                local e = {
                    imghash = f:read_u32(),
                    imgindex = f:read_u32(),
                    layerhash = f:read_u32(),
                    matrix = f:read_f32_matrix(),
                    z_index = (f:read_f32() + 5)* num / 10 + 0.5
                }
                v[i] = e
            end
            v.raw = nil
        end
    end
end

-- loader for *.xml file
XmlLoader = Class(function(self, f, skip_image_parser)
    local function error(e)
        self.error = e
        funcprint("Error in XmlLoader._ctor(): "..e)
    end

    local s = f:read_to_end()
    f:close()

    if s == nil or #s == 0 then
        return error(ERROR.UNEXPECTED_EOF)
    end

    if skip_image_parser ~= true then 
        local success, result = self.ImageAtlasParser(s)
        if success then
            self.texname, self.imgs = unpack(result)
            return
        end
    end

    -- print("use slaxdom parser...")
    local success, dom = pcall(function() return slaxdom:dom(s) end)
    if success and type(dom) == "table" then
        local node = dom:find_elements("Atlas")[1]
        if node == nil then
            return error(ERROR.XML_ELEMENT_NOT_FOUND)
        end
        local texture = node:find_elements("Texture")[1]
        if texture == nil then
            return error(ERROR.XML_ELEMENT_NOT_FOUND)
        end
        self.texname = texture.attr.filename
        if self.texname == nil then
            return error(ERROR.XML_TEX_FILENAME_NOT_FOUND)
        elseif self.texname:find("[/\\]") then
            return error(ERROR.XML_TEX_FILENAME_INVALID)
        end
        local elements = node:find_elements("Elements")[1]
        if elements == nil then
            return error(ERROR.XML_ELEMENT_NOT_FOUND)
        end

        self.imgs = {}
        for _, v in ipairs(elements:find_elements("Element")) do
            local attr = v.attr or {}
            if attr.name and attr.u1 and attr.u2 and attr.v1 and attr.v2 then
                self.imgs[attr.name] = {
                    name = attr.name,
                    u1 = attr.u1,
                    v1 = attr.v1,
                    u2 = attr.u2,
                    v2 = attr.v2,
                }
            end
        end
    else
        return error("Xml file parse error: "..dom)
    end
end)

function XmlLoader:Get(name)
    return self.imgs[name]
end

function XmlLoader:GetLoosely(name)
    if self.error then
        return nil
    end
    if self.imgs[name] then
        return self.imgs[name]
    end
    if self.imgs[name..".png"] then
        return self.imgs[name..".png"]
    end
    if self.imgs[name..".tex"] then
        return self.imgs[name..".tex"]
    end
end

function XmlLoader:__tostring()
    if self.error then
        return string.format("Xml<error=%s>", self.error)
    else
        return string.format("Xml<imgs=%d>", GetTableSize(self.imgs))
    end
end

-- a simpler parser (high performance)
function XmlLoader.ImageAtlasParser(s)
    local texname = nil
    local imgs = {}
    do
        local i = select(2, s:find("Texture%s*filename"))
        if i ~= nil then
            texname = select(3, s:find("\"([^\"]*)\"", i))
            if texname == nil then
                return false, ERROR.XML_TEX_FILENAME_NOT_FOUND
            elseif texname:find("[/\\]") then
                return false, ERROR.XML_TEX_FILENAME_INVALID
            end
        end
    end
    do
        local i = select(2, s: find("<Elements>"))
        if i ~= nil then
            for content in s:gmatch("<Element%s([^/]+)/>") do
                local img = {}
                for k,v in content:gmatch("([nameuv12]+)%s*=%s*\"([^\"]+)\"")do
                    if k ~= "name" then v = tonumber(v) end
                    img[k] = v
                end
                if img.name and img.u1 and img.u2 and img.v1 and img.v2 then
                    imgs[img.name] = img
                end
            end
        end
    end

    -- dev branch: check word count
    local c1 = s:count("Atlas")
    local c2 = s:count("Elements")
    local c3 = s:count("Element")
    if c1 ~= 2 or c2 ~= 2 or c3 ~= GetTableSize(imgs) + 2 then
        print("Warning: xml re parser failed")
        return false, "Parse failed"
    end

    return true, {texname, imgs}
end

-- loader for *.tex file
TexLoader = Class(function(self, f)
    local function error(e)
        self.error = e
        funcprint("Error in TexLoader._ctor(): "..e)
        f:close()
    end

    if f:read_string(4) ~= "KTEX" then
        return error("KTEX file sig not satisfied")
    end

    local header = f:read_u32()
    if header == nil then
        return error(ERROR.UNEXPECTED_EOF)
    end

    local nummips = --[[(header >> 13) & 31]] math.floor(header / 8192) % 32
    local pixelformat = --[[(header >> 4) & 31]] math.floor(header / 16) % 32
    -- {
    --     [0] = "DXT1",
    --     [1] = "DXT3",
    --     [2] = "DXT5",
    --     [4] = "ARGB",
    --     [5] = "RGB",
    --     [7] = "Unknown",
    -- }
    local mipmaps = {}
    self.nummips = nummips
    self.pixelformat = pixelformat
    self.mipmaps = mipmaps

    if pixelformat == 0 or pixelformat == 2 or pixelformat == 5 then -- DXT1 / DXT5 / RGB
        for i = 1, nummips do
            local w, h, p, s = f:read_and_unpack("HHHI")
            if s == nil then
                return error(ERROR.UNEXPECTED_EOF)
            end

            table.insert(mipmaps, {width = w, height = h, datasize = s})
        end
        for i = 1, nummips do
            local bytes = f:read_string(mipmaps[i].datasize)
            if bytes == nil then
                return error(ERROR.UNEXPECTED_EOF)
            end

            mipmaps[i].data = bytes
        end
    else
        return error("Unsupported pixelformat: "..pixelformat)
    end

    f:close()
end)

function TexLoader:NormalizeMipIndex(i)
    return math.clamp(i, 1, #self.mipmaps)
end

function TexLoader:GetSize(i)
    i = self:NormalizeMipIndex(i or 1)
    local info = self.mipmaps[i]
    return info.width, info.height
end

function TexLoader:GetTextureData(i)
    i = self:NormalizeMipIndex(i)
    return self.mipmaps[i] and self.mipmaps[i].data
end

function TexLoader:GetImage(i)
    local bytes, width, height = self:GetImageBytes(i)
    if bytes then
        if self.pixelformat == 5 then
            return Image.From_RGB(bytes, width, height)
        elseif self.pixelformat == 2 or self.pixelformat == 0 then
            return Image.From_RGBA(bytes, width, height)
        end
    end
end

function TexLoader:GetImageBytes(i)
    i = self:NormalizeMipIndex(i)
    local m = self.mipmaps[i]
    if m ~= nil then
        if m.pixels ~= nil then -- use cache
            return m.pixels, m.width, m.height
        end

        if self.pixelformat == 5 then
            m.pixels = FlipBytes(m.data, m.width*3)
            m.data = nil
            return m.pixels, m.width, m.height
        elseif self.pixelformat == 2 then
            m.pixels = DXT5_Decompress(m.data, m.width, m.height)
            m.pixels = DivAlpha(FlipBytes(m.pixels, m.width*4))
            return m.pixels, m.width, m.height
        elseif self.pixelformat == 0 then
            m.pixels = DXT1_Decompress(m.data, m.width, m.height)
            m.pixels = DivAlpha(FlipBytes(m.pixels, m.width*4))
            return m.pixels, m.width, m.height
        else
            error("Unsupported pixelformat: "..self.pixelformat)
        end
    end
end

function TexLoader:GetImageBytesWithRegion(i, bbox --[[x, y, w, h]])
    i = self:NormalizeMipIndex(i)
    local m = self.mipmaps[i]
    local x = math.floor(bbox[1] + 0.5)
    local y = math.floor(bbox[2] + 0.5)
    local w = math.floor(bbox[3] + 0.5)
    local h = math.floor(bbox[4] + 0.5)
    if m ~= nil then
        if m.pixels ~= nil then
            return CropBytes(m.pixels, x, y, w, h), w, h
        end

        if self.pixelformat == 2 then
            --
        end
    end
end

function TexLoader:__tostring()
    if self.error then
        return string.format("Tex<error=%s>", self.error)
    else
        return string.format("Tex<nummips=%d>", #self.mipmaps)
    end
end

-- loader for .ksh file
KshLoader = Class(function(self, f)
    local function error(e)
        self.error = e
        funcprint("Error in KshLoader._ctor(): "..e)
        f:close()
    end

    if not f:seek_to_string(".vs") then
        return error("Failed to found *.vs file identifier")
    end
    local len = f:read_u32()
    local vs = f:read_exact(len)
    if #vs ~= len then
        return error("Failed to parse *.vs file content: size not match")
    elseif not string.is_utf8(vs) then
        return error("Failed to parse *.vs file content: not valid utf-8 string")
    end
    if not f:seek_to_string(".ps") then
        return error("Failed to found *.ps file identifier")
    end
    local len = f:read_u32()
    local ps = f:read_exact(len)
    if #ps ~= len then
        return error("Failed to parse *.ps file content: size not match")
    elseif not string.is_utf8(ps) then
        return error("Failed to parse *.ps file content: not valid utf-8 string")
    end

    self.ps = ps
    self.vs = vs
    f:close()
end)

function KshLoader:__tostring()
    if self.error then
        return string.format("Ksh<error=%s>", self.error)
    else
        return string.format("Ksh<vs=[%d] ps=[%d]>", #self.vs, #self.ps)
    end
end

-- loader for *.zip file
-- https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
ZipLoader = Class(function(self, f, name_filter)
    self.contents = {}

    local function error(e)
        self.error = e
        funcprint("Error in ZipLoader._ctor(): "..e)
        f:close()
    end

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
            return error(ERROR.UNSUPORTED_ZIP_COMPRESS_METHOD)
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

        local name = f:read_string(name_len)
        local data_starts = f:tell()
        if name_filter ~= nil and name_filter(name) == true then
            local compressed_data = f:read_exact(compressed_len)
            if compressed_data ~= nil then
                if method == "stored" then
                    self.contents[name] = { raw_data = compressed_data, mtime = mtime }
                elseif name_filter == self.NAME_FILTER.ALL_LAZY then
                    self.contents[name] = { compressed_data = compressed_data, mtime = mtime, lazy = true }
                else
                    local raw_data = Deflate(compressed_data)
                    self.contents[name] = raw_data ~= nil and { raw_data = raw_data, mtime = mtime } or nil
                end
            end
        else
            f:seek_forward(compressed_len)
            self.contents[name] = { data_starts = data_starts, compressed_len = compressed_len, mtime = mtime }
        end
    end

    self.f = f
end)

function ZipLoader:Close()
    if self.f then
        self.f:drop()
    end
end

function ZipLoader:Get(name)
    local data = self.contents[name]
    if data ~= nil then
        if data.lazy then
            -- delay delfate
            data.raw_data = Deflate(data.compressed_data)
            data.lazy = nil
            data.compressed_data = nil
        end
        return data.raw_data, data.mtime
    end
end

function ZipLoader:GetModified(name)
    local data = self.contents[name]
    return data and data.mtime
end

function ZipLoader:Exists(name)
    return self.contents[name] ~= nil
end

function ZipLoader:List()
    local result = {}
    for k in pairs(self.contents)do
        table.insert(result, k)
    end
    return result
end

ZipLoader.NAME_FILTER = {
    ALL = function() return true end,
    ALL_LAZY = function() return true end,
    ANIM = function(name) return name == "anim.bin" end,
    BUILD = function(name) return name == "build.bin" end,
    INDEX = function(name) return name == "anim.bin" or name == "build.bin" end,
}

-- -- load anim.bin in zipfile, make sure that path is a file
-- function ZipLoader.LoadAnim(path, ...)
--     local zip = ZipLoader(CreateReader(path), ZipLoader.NAME_FILTER.ANIM)
--     local anim_raw = zip and zip:Get("anim.bin")
--     local anim = anim_raw and AnimLoader(CreateBytesReader(anim_raw), ...)
--     if anim and not anim.error then
--         return anim
--     end
-- end

-- -- load build.bin in zipfile, make sure that path is a file
-- function ZipLoader.LoadBuild(path, ...)
--     local zip = ZipLoader(CreateReader(path), ZipLoader.NAME_FILTER.BUILD)
--     local build_raw = zip and zip:Get("build.bin")
--     local build = build_raw and BuildLoader(CreateBytesReader(build_raw), ...)
--     if build and not build.error then
--         return build
--     end
-- end

DynLoader = Class(ZipLoader, FileSystem.DynLoader_Ctor)

local function FmodBytesToGUID(bytes)
    assert(type(bytes) == "string")
    assert(#bytes == 16)
    local buffer = {}
    for i = 1, 16 do
        table.insert(buffer, string.format("%02x", string.byte(bytes, i)))
    end
    local p1 = table.concat({buffer[4], buffer[3], buffer[2], buffer[1]}, "")
    local p2 = table.concat({buffer[6], buffer[5]}, "")
    local p3 = table.concat({buffer[8], buffer[7]}, "")
    local p4 = table.concat(buffer, "", 9, 10)
    local p5 = table.concat(buffer, "", 11, 16)
    return table.concat({p1, p2, p3, p4, p5}, "-")
end

-- loader for *.fev file, only parse sound reference, other data are loaded from libfmodex
FevLoader = Class(function(self, f)
    local function error(e)
        self.error = e
        funcprint("Error in FevLoader._ctor(): "..e)
        f:close()
    end
    local function trim(s)
        if s:endswith("\0") then
            s = s:sub(1, #s-1)
        end
        return s
    end
    f:seek_to_string("RIFF")
    f:seek_to_string("LIST")
    f:seek_to_string("PROJ")
    f:seek_to_string("OBCT")
    f:seek_forward(20)
    local numbanks = f:read_u32()
    f:seek_forward(4)
    local numcategories = f:read_u32()
    f:seek_forward(4)
    local numgroups = f:read_u32()
    f:seek_forward(36)
    local numevents = f:read_u32()
    f:seek_forward(28)
    local numreverbs = f:read_u32()
    f:seek_forward(4)
    local numwaveforms = f:read_u32()
    f:seek_forward(28)
    local numsounddefs = f:read_u32()
    f:seek_forward(128)
    local name = f:read_variable_length_string()

    print(string.format("\n%d Banks\n%d Categories\n%d Events\n%d Waveforms\n%d Sounddefs\n",
        numbanks, numcategories, numevents, numwaveforms, numsounddefs))
    print(name)

    self.numbanks = numbanks
    self.numevents = numevents
    self.numcategories = numcategories
    self.numwaveforms = numwaveforms
    self.numsounddefs = numsounddefs

    f:seek_to_string("LGCY")
    f:seek_forward(12)
    self.project_name = trim(f:read_variable_length_string())

    local bank_list = {} -- fmod sound bank / fsb
    f:seek_forward(8)
    for i = 1, numbanks do
        f:seek_forward(20)
        local name = trim(f:read_variable_length_string())
        table.insert(bank_list, name)
    end

    self.bank_list = bank_list

    local category_list = {}
    for i = 1, numcategories do
        local name = trim(f:read_variable_length_string())
        f:seek_forward(20)
        table.insert(category_list, name)
    end

    local name_object = {}

    local event_list = {}
    local function ParseEvent()
        local type = f:read_u32()
        if type == 16 then -- simple event
            local name_index = f:read_u32()
            local guid_bytes = f:read_exact(16)
            local guid = FmodBytesToGUID(guid_bytes)
            f:seek_forward(144)
            local num = f:read_u32()
            assert(num == 1 or num == 0, "simple event must have only 0/1 sounddef")
            local index = f:read_u32()
            f:seek_forward(58)
            local category = f:read_variable_length_string()
            assert(#category > 2, "Failed to get cateogry name at "..f:tell())
            local event = {
                type = "simple",
                name_index = name_index,
                guid = guid,
                has_sounddef = num == 1,
                sounddef_list = { index },
            }
            table.insert(event_list, event)
            table.insert(name_object, event)
        elseif type == 8 then -- multi-track event
            local name_index = f:read_u32()
            local guid_bytes = f:read_exact(16)
            local guid = FmodBytesToGUID(guid_bytes)
            f:seek_forward(144)
            local numlayers = f:read_u32()
            local refs = {}
            for j = 1, numlayers do
                f:seek_forward(6)
                local numsounds = f:read_u16()
                local numenvelopes = f:read_u16()
                assert(numsounds + numenvelopes < 100, "Too many numsounds or numenvelopes at "..f:tell())
                for k = 1, numsounds do
                    local index = f:read_u16()
                    table.insert(refs, index)
                    f:seek_forward(56)
                end
                for k = 1, numenvelopes do
                    f:seek_forward(4)
                    local length = f:read_u32()
                    if length > 0 then
                        f:seek_forward(length) -- FMOD Highpass Simple / FMOD Lowpass Simple / ...
                    end
                    f:seek_forward(12)
                    local numpoints = f:read_u32()
                    f:seek_forward(4*numpoints)
                    f:seek_forward(8)
                end
            end
            local numparams = f:read_u32()
            f:seek_forward(32*numparams)
            f:seek_forward(8)
            local category = f:read_variable_length_string()
            assert(#category > 2, "Failed to get cateogry name at "..f:tell())
            local event = {
                type = "multi-track",
                name_index = name_index,
                guid = guid,
                has_sounddef = #refs > 0,
                sounddef_list = refs,
            }
            table.insert(event_list, event)
            table.insert(name_object, event)
        else
            error("Event type number invalid at "..f:tell())
            return true
        end
    end

    local function ParseGroup()
        local group_name_index = f:read_u32()
        f:seek_forward(4)
        local numsubgroups = f:read_u32()
        local numevents = f:read_u32()
        for i = 1, numsubgroups do
            if ParseGroup() then
                return true
            end
        end
        for i = 1, numevents do
            if ParseEvent() then
                return true
            end
        end
    end

    local numrootgroups = f:read_u32()
    for i = 1, numrootgroups do
        ParseGroup()
    end
    
    local num = f:read_u32()
    f:seek_forward(74* num) -- unknown data with known size :p

    -- -- TODO:
    -- -- it's quite hard to locate starting of sounddef region
    -- -- so use some fuzzy search method to find it
    -- -- * may skip sounddef without any source file
    -- -- * may cause incorrect sounddef index
    -- while false do
    --     local s = f:seek_to_next_string(4)
    --     if not s:find(">") and not s:find("<") and not s:find("?") and s:byte(#s-3) == 46 then
    --         local ext = s:sub(#s - 3, #s)
    --         if ext ~= ".wav" and ext ~= ".mp3" then
    --             error("Unexpected sound file extension: "..ext)
    --         end
    --         local current = f:tell()
    --         f:seek_to(current - #s - 5 - 8 - 12)
    --         break
    --     end
    -- end
    -- 
    -- ↑ now it's solved
    
    local numsounddefs = f:read_u32() -- same as self.numsounddefs
    local sounddef_list = {}
    for i = 1, numsounddefs do
        -- print(">>>>>>>>>>>>>>> Def", i, f:tell())
        local name_index = f:read_u32()
        local num = f:read_u32()
        local sounddef = {
            name_index = name_index,
            file_list = {},
        }
        local numwaveforms = f:read_u32()
        for j = 1, numwaveforms do
            local type = f:read_u32()
            local weight = f:read_u32()
            if type == 0 then
                local path = trim(f:read_variable_length_string())
                local num = f:read_u32()
                local index = f:read_u32()
                local lengthms = f:read_u32()
                table.insert(sounddef.file_list, {
                    path = path,
                    lengthms = lengthms,
                    num = num, -- ukn num...
                    index = index, -- ukn index...
                })
            elseif type == 1 then
                f:seek_forward(8)
            elseif type == 2 or type == 3 then
                -- do nothing
            end
        end

        table.insert(sounddef_list, sounddef)
        table.insert(name_object, sounddef)
    end
    f:seek_to_string("EPRP")
    f:seek_to_string("STRR")
    local len = f:read_u32()
    local numstrings = f:read_u32()
    local offset_list = {}
    for i = 1, numstrings do
        table.insert(offset_list, f:read_u32())
    end
    local content = f:read_exact(len - 4 - 4* numstrings)
    local string_table = {}
    for i = 1, #offset_list - 1 do
        local s = trim(content:sub(offset_list[i] + 1, offset_list[i + 1]))
        table.insert(string_table, s)
    end
    -- last string
    local s = trim(content:sub(offset_list[#offset_list] + 1, #content))
    table.insert(string_table, s)

    self.string_table = string_table

    for k, v in ipairs(name_object)do
        v.name = self:GetStringByIndex(v.name_index)
    end

    self.event_list = event_list
    self.sounddef_list = sounddef_list

    f:close()

    self:UNSTABLE_AlignSounddefIndex()
end)

function FevLoader:GetStringByIndex(index, strict)
    local value = self.string_table[index + 1]
    if strict ~= false and value == nil then
        error("Failed to get global string["..index.."] (table size is "..#self.string_table..")")
    end
    return value
end

function FevLoader:UNSTABLE_AlignSounddefIndex()
    if self.numwaveforms == 0 then
        self.sounddef_offset = 0
    else
        local max_index = 0
        for _, v in ipairs(self.event_list)do
            for _, index in ipairs(v.sounddef_list)do
                max_index = math.max(max_index, index)
            end
        end
        assert(max_index + 1 == #self.sounddef_list)
    end
end

-- loader for *.fsb file
-- this part is modified from `python-fsb5`
local FsbLoader = Class(function(self, f)
    assert(f:read_exact(4) == "FSB5")
    local version = f:read_u32()
    assert(version > 0)
    local numsamples = f:read_u32()
    local sample_headers_size = f:read_u32()
    local string_table_size = f:read_u32()
    local data_size = f:read_u32()
    local mode = f:read_u32()
    f:seek_forward(32)
    local header_size = f:tell()
    print(f:tell())
    print(numsamples)
    print(string_table_size)
    for i = 1, numsamples do
        --
    end
    f:seek_to(header_size + sample_headers_size)
    print(f:tell())
    local offset_list = {}
    local string_table = {}
    for i = 1, numsamples do
        table.insert(offset_list, f:read_u32())
    end
    local start = numsamples* 4
    local content = f:read_exact(string_table_size - start)
    for i = 1, numsamples - 1 do
        table.insert(string_table, 
            content:sub(offset_list[i] - start, offset_list[i + 1] - start - 1))
    end
    -- last one
    local s = content:sub(offset_list[numsamples] - start + 1, #content)
    while s:endswith("\0") do -- trim end of string
        s = s:sub(1, #s - 1)
    end
    table.insert(string_table, s)


    exit()
end)

function FsbLoader:GetFileExtension(format)
    if type(format) == "number" then
        format = assert(self.FORMAT[format], "Invalid format number: "..format)
    end
    return format == "VORBIS" and "ogg"
        or format == "PCM8" or format == "PCM16" or format == "PCM32" and "wav"
        or format == "MPEG" and "mp3"
        or "bin"
end

-- FsbLoader(FileSystem.CreateReader("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/mods/sakana/sound/lycoreco_sfx0.fsb"))


FsbLoader.FORMAT = {
    "PCM8", -- [1]
    "PCM16",
    "PCM24",
    "PCM32",
    "PCMFLOAT",
    "GCADPCM",
    "IMAADPCM",
    "VAG",
    "HEVAG",
    "XMA",
    "MPEG",
    "CELT",
    "AT9",
    "XWMA",
    "VORBIS", -- [15]
}
-- FevLoader(FileSystem.CreateReader("/Users/wzh/Desktop/mod_tools/FMOD_Designer/test2/test.fev"))
-- FevLoader(FileSystem.CreateReader("/Users/wzh/Desktop/mod_tools/FMOD_Designer/test3/test.fev"))
-- FevLoader(FileSystem.CreateReader("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/mods/sakana/sound/lycoreco_sfx0.fev"))
-- FevLoader(FileSystem.CreateReader("/Users/wzh/Desktop/mod_tools/FMOD_Designer/test8/test.fev"))
-- exit()
-- FevLoader(FileSystem.CreateReader("/Users/wzh/WIN-230201/desktop/homura-12.8/sound/lw_homura.fev"))
-- FevLoader(FileSystem.CreateReader("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/data/sound/yotc_2022_2.fev"))
-- exit()
local p = FileSystem.Path("/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/data/sound/")
local temp2 = {}
for _, fev in ipairs(p:iter_file_with_extension("fev")) do
    print(fev)
    local a,b = pcall(function()FevLoader(FileSystem.CreateReader(fev)) end)
    if not a then
        table.insert(temp2, fev:name())
        print(fev:name())
        print(b)
        exit()
        break
    end
end

print(json.encode(temp2))
if #temp2 >0 then exit() end

-- exit()