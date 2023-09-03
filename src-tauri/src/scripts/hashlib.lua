local smallhash = Algorithm.SmallHash_Impl
UnsolvedHash = Class(function(self, h)
    assert(type(h) == "number")
    self.hash = h
end)

function UnsolvedHash:Solve()
    local s = HashLib:Hash2String(self.hash)
    return s or self
end

function UnsolvedHash:__tostring()
    return string.format("Hash<"..self.hash..">")
end

HashLib = Class(function(self)
    self.map_string = {} -- string -> number
    self.map_number = {} -- number -> string

    for k,v in pairs(Persistant.Hash.data)do
        if type(k) == "string" then
            self:String2Hash(k)
        end
    end
end)

function HashLib:AddHash(s, h)
    assert(type(s) == "string")
    assert(type(h) == "number")
    if self:Hash2String(h) ~= nil then
        return
    end

    if smallhash(s) == h then
        self.map_string[s:lower()] = h
        self.map_number[h] = s:lower()
    else
        if s:isascii() then
            print("Warning: hash pair failed to check: `"..s.."` -> "..h)
        end
    end
end

function HashLib:Hash2String(h)
    return self.map_number[h]
end

function HashLib:String2Hash(s)
    s = s:lower()
    if self.map_string[s] == nil then
        self.map_string[s] = smallhash(s)
    end
    return self.map_string[s]
end

function HashLib:Size()
    return GetTableSize(self.map_number)
end

function HashLib:Dumps()
    local temp = {}
    for k,v in pairs(self.map_string)do
        table.insert(temp, {k, v})
    end
    return json.encode_compliant(temp)
end

function HashLib:ParseFile(f)
    local n = f:read_u32() or 0
    if n > 0 then
        for i = 1, n do
            local h = f:read_u32()
            local s = f:read_variable_length_string()
            if s == nil then
                break
            end

            self:AddHash(s, h)
        end
        local r = f:read_to_end()
        if r and #r > 0 then
            print("Warning: surplus "..#r.." byte(s) after parsing hash")
        end
    end
end

HashLib = HashLib()