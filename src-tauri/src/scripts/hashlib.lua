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
            local h = self:String2Hash(k)
            self.map_number[h] = k:lower()
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
        if s:is_ascii() then
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

function HashLib:Serialize()
    local result = {}
    for k,v in pairs(self.map_string)do
        if k:is_ascii() then
            table.insert(result, {k, v})
            -- TODO: utf-8 and non utf-8 are ignored
            -- may add in future
        end
    end
    return result
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

function HashLib:UpdateFromTable(t)
    for h, s in pairs(t)do
        -- if type(s) == "string" and type(h) == "number" then
            self:AddHash(s, h)
        -- end
    end
end

HashLib = HashLib()