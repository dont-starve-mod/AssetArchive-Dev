-- Don't Starve Affine Transform
-- a c tx
-- b d ty
-- 0 0 1   (constant)

Affine = Class(function(self, a, b, c, d, tx, ty)
	if type(a) == "table" then
		assert(#a >= 4)
		a, b, c, d, tx, ty = unpack(a)
	end

	self.a = a or 1
	self.b = b or 0
	self.c = c or 0
	self.d = d or 1
	self.tx = tx or 0
	self.ty = ty or 0
end)

function Affine:Reverse()
	local j = self.d*self.a-self.b*self.c
	return Affine(
		self.d/j, 
        self.b/-j, 
        self.c/-j, 
        self.a/j, 
        (self.c*self.ty-self.d*self.tx)/j, 
        (self.b*self.tx-self.a*self.ty)/j
    )
end

function Affine:__mul(rhs)
	return Affine(
        self.a*rhs.a+self.b*rhs.c,
        self.a*rhs.b+self.b*rhs.d,
        self.c*rhs.a+self.d*rhs.c,
        self.c*rhs.b+self.d*rhs.d,
        self.a*rhs.tx+self.b*rhs.ty+self.tx,
        self.c*rhs.tx+self.d*rhs.ty+self.ty
    )
end

function Affine:Translate(x, y)
	return Affine(
		self.a,
		self.b,
		self.c,
		self.d,
		self.tx + x,
		self.ty + y
	)
end

function Affine:ToLinear()
	return Affine(
		self.a,
		self.b,
		self.c,
		self.d,
		0, 0)
end

function Affine:OnPoint(x, y)
	return self.tx + self.a * x + self.c * y, 
      	   self.ty + self.b * x + self.d * y
end

function Affine:ToArray()
	return {
		self.a,
		self.b,
		self.c,
		self.d,
		self.tx,
		self.ty,
	}
end