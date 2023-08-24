-- animation facing definition

FACING_RIGHT        = 1
FACING_UP           = 2
FACING_LEFT         = 4
FACING_DOWN         = 8
FACING_UPRIGHT      = 16
FACING_UPLEFT       = 32
FACING_DOWNRIGHT    = 64
FACING_DOWNLEFT     = 128
FACING_ALL          = 255 -- (1 << 8) - 1
FACING_SIDE         = FACING_LEFT + FACING_RIGHT

Facing = Class(function(self, byte)
	self.byte = math.floor(byte + 0.5)
	self.ctor_data = nil
end)

function Facing.Unsolved(data)
	self.ctor_data = data
	self.invalid = true
end

function Facing.FromByte(byte)
	assert(type(byte) == "number")
	assert(byte >= 0 and byte <= 255)

	return Facing(byte)
end

Facing.SCML_ALIAS = {
    up        = FACING_UP, 
    down      = FACING_DOWN,
    side      = FACING_SIDE, 
    left      = FACING_LEFT,
    right     = FACING_RIGHT, 
    upside    = FACING_UPRIGHT + FACING_UPLEFT, 
    downside  = FACING_DOWNLEFT + FACING_DOWNRIGHT, 
    upleft    = FACING_UPLEFT,
    upright   = FACING_UPRIGHT,
    downleft  = FACING_DOWNLEFT,
    downright = FACING_DOWNRIGHT,
    ["45s"]   = FACING_UPLEFT + FACING_UPRIGHT + FACING_DOWNLEFT + FACING_DOWNRIGHT,
    ["90s"]   = FACING_UP + FACING_DOWN + FACING_SIDE,
    all       = FACING_ALL,
}

function Facing.FromScmlAlias(postfix)
	if postfix:sub(1,1) == "_" then
		postfix = postfix:sub(2)
	end
	local byte = Facing.SCML_ALIAS[postfix]
	if byte ~= nil then
		return Facing.FromByte(byte)
	else
		return Facing.Unsolved(postfix)
	end
end

function Facing.FromAlias(alias)
	if alias:startswith("f-") then
		local num = tonumber(alias:sub(3))
		if num >= 0 and num <= 255 then
			return Facing.FromByte(num)
		else
			return Facing.Unsolved(alias)
		end
	end
	return Facing.FromScmlAlias(alias)
end

function Facing.ParseScmlAnimationName(name)
	for k,v in pairs(Facing.SCML_ALIAS)do
		if name:endswith("_"..k) then
			return name:sub(1, #name - #k - 1), Facing.FromByte(v)
		end
	end
	return name, Facing.FromByte(FACING_ALL)
end

function Facing:GetScmlAlias()
	for k,v in pairs(Facing.SCML_ALIAS)do
		if v == self.byte then
			return k
		end
	end
end

function Facing:GetAlias()
	return self:GetScmlAlias() or ("f-" .. self.byte)
end

function Facing:IsValid()
	return not self.invalid
end

function Facing:__eq(rhs)
	return self.byte == rhs.byte
end

function Facing:__tostring()
	if self.ctor_data then
		return "Facing<[invalid] "..self.ctor_data..">"
	else
		return "Facing<"..self:GetAlias().."["..self.byte.."]>"
	end
end