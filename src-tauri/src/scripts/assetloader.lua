local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local Deflate = Algorithm.Deflate
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
    for i = 1, numsymbols do
        local imghash = f:read_u32()
        local numimgs = f:read_u32()
        if numimgs == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end
        if lazy and imghash ~= self.SWAP_ICON then
            f:seek_forward(numimgs * 32)
        else
            local imgs = { imghash = imghash }
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
                table.insert(imgs, img)
                table.insert(allimgs, img)
            end

            if lazy then
                if #imgs >= 1 and imgs[1].index == 0 then
                    self.swap_icon_0 = imgs[1]
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

                local cw = (right - left) / max(umax - umin, .01)
                local ch = (top - bottom) / min(vmax - vmin, -.01)
                local bbx = umin * cw - (left - x_offset)
                local bby = (1-vmin) * ch - (top - y_offset)

                table.insert(temp.sampler, sampler)
                table.insert(temp.bbx, bbx)
                table.insert(temp.bby, bby)
                table.insert(temp.cw, cw)
                table.insert(temp.ch, ch)
            end

            img.sampler = math.floor(average(temp.sampler) + 0.5)
            img.bbx = round2(average(temp.bbx))
            img.bby = round2(average(temp.bby))
            img.cw = round2(average(temp.cw))
            img.ch = round2(average(temp.ch))

            if not lazy then
                img.vertexindex = nil
                img.numvertexs = nil
            end
        end
    end

    self.builddata = {name = name, atlas = self.atlas, symbol = symbol}
    self.symbol_map = {}
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

BuildLoader.SWAP_ICON = HashLib:String2Hash("SWAP_ICON")

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
AnimLoader = Class(function(self, f, lazy)
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

    self.lazy = lazy

    for i = 1, numanims do
        local name = f:read_variable_length_string()
        local facing = f:read_exact(1)
        local bankhash = f:read_u32()
        local framerate = f:read_f32()
        local numframes = f:read_u32()
        if numframes == nil then
            return error(ERROR.UNEXPECTED_EOF)
        end

        for j = 1, numframes do
            f:seek_forward(16) --rect
            local numevents = f:read_u32()
            if numevents == nil then
                return error(ERROR.UNEXPECTED_EOF)
            end
            f:seek_forward(numevents* 4)
            local numelements = f:read_u32()
            if numelements == nil then
                return error(ERROR.UNEXPECTED_EOF)
            end
            f:seek_forward(numelements* 40)
        end
    end

    HashLib:ParseFile(f)

    f:close()
end)

-- loader for *.xml file
XmlLoader = Class(function(self, f)
    local function error(e)
        self.error = e
        funcprint("Error in XmlLoader._ctor(): "..e)
        f:close()
    end

    local s = f:read_to_end()
    if s ~= nil and #s > 0 then
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
            self.tex = texture.attr.filename
            if self.tex == nil then
                return error(ERROR.XML_TEX_FILENAME_NOT_FOUND)
            end
            local elements = node:find_elements("Elements")[1]
            if elements == nil then
                return error(ERROR.XML_ELEMENT_NOT_FOUND)
            end

            self.imgs = {}
            for _, v in ipairs(elements:find_elements("Element")) do
                local attr = v.attr or {}
                if attr.name and attr.u1 and attr.u2 and attr.v1 and attr.v2 then
                    self.imgs[attr.name] = attr
                end
            end
        else
            return error("Xml file parse error: "..dom)
        end
    else
        return error("Xml file failed to load")
    end

    f:close()
end)

function XmlLoader:Get(name)
    return self.imgs[name]
end

function XmlLoader:__tostring()
    if self.error then
        return string.format("Xml<error=%s>", self.error)
    else
        return string.format("Xml<imgs=%d>", GetTableSize(self.imgs))
    end
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

    if pixelformat == 2 or pixelformat == 5 then -- DXT5 / RGB
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

function TexLoader:GetTextureData(i)
    i = self:NormalizeMipIndex(i)
    return self.mipmaps[i] and self.mipmaps[i].data
end

function TexLoader:GetImage(i)
    i = self:NormalizeMipIndex(i)
    local m = self.mipmaps[i]
    if m ~= nil then
        if self.pixelformat == 5 then
            return Image.From_RGB(m.data)
        elseif self.pixelformat == 2 then
            if m.pixels ~= nil then -- use cache
                return Image.From_RGBA(m.pixels, m.width, m.height)
            else
                m.pixels = Algorithm.DXT5_Decompress(m.data, m.width, m.height)
                return Image.From_RGBA(m.pixels, m.width, m.height)
            end
        else
            error("Unsupported pixelformat: "..self.pixelformat)
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
        f:seek_forward(4)

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
            local compressed_data = f:read_string(compressed_len)
            if compressed_data ~= nil then
                local raw_data = Deflate(compressed_data)
                if raw_data ~= nil then
                    self.contents[name] = { raw_data = raw_data }
                end
            end
        else
            f:seek_forward(compressed_len)
            self.contents[name] = { data_starts = data_starts, compressed_len = compressed_len }
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
    return self.contents[name] and self.contents[name].raw_data
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
    ANIM = function(name) return name == "anim.bin" end,
    BUILD = function(name) return name == "build.bin" end,
    INDEX = function(name) return name == "anim.bin" or name == "build.bin" end,
}

function ZipLoader.LoadAnim(path, ...)
    local zip = ZipLoader(CreateReader(path, ZipLoader.NAME_FILTER.ANIM))
    local anim_raw = zip and zip:Get("anim.bin")
    local anim = anim_raw and AnimLoader(CreateBytesReader(anim_raw), ...)
    if anim and not anim.error then
        return anim
    end
end

DynLoader = Class(ZipLoader, FileSystem.DynLoader_Ctor)

function DynLoader.IsDyn(path)
    local f = CreateReader(path)
    if f then
        local result = f:read_string(#DYN_SIG) == DYN_SIG
        f:close()
        return result
    end
end

function DynLoader.IsZip(path)
    local f = CreateReader(path)
    if f then
        local result = f:read_string(#ZIP_SIG) == ZIP_SIG
        f:close()
        return result
    end
end