-- class.lua
-- Compatible with Lua 5.1 (not 5.0).

local function _is_a(self, klass)
	local m = getmetatable(self)
	while m do
		if m == klass then return true end
		m = m._base
	end
	return false
end

local function _is_class(self)
	return rawget(self, "is_instance") ~= nil
end

local function __index(t, k)
    local p = rawget(t, "_")[k]
    if p ~= nil then
        return p[1]
    end
    return getmetatable(t)[k]
end

local function __newindex(t, k, v)
    local p = rawget(t, "_")[k]
    if p == nil then
        rawset(t, k, v)
    else
        local old = p[1]
        p[1] = v
        p[2](t, v, old)
    end
end

local function __dummy()
end

local function onreadonly(t, v, old)
    assert(v == old, "Cannot change read only property")
end

function makereadonly(t, k)
    local _ = rawget(t, "_")
    assert(_ ~= nil, "Class does not support read only properties")
    local p = _[k]
    if p == nil then
        _[k] = { t[k], onreadonly }
        rawset(t, k, nil)
    else
        p[2] = onreadonly
    end
end

function addsetter(t, k, fn)
    local _ = rawget(t, "_")
    assert(_ ~= nil, "Class does not support property setters")
    local p = _[k]
    if p == nil then
        _[k] = { t[k], fn }
        rawset(t, k, nil)
    else
        p[2] = fn
    end
end

function removesetter(t, k)
    local _ = rawget(t, "_")
    if _ ~= nil and _[k] ~= nil then
        rawset(t, k, _[k][1])
        _[k] = nil
    end
end

function Class(base, _ctor, props)
    local c = {}    -- a new class instance
    local c_inherited = {}
	if not _ctor and type(base) == 'function' then
        _ctor = base
        base = nil
    elseif type(base) == 'table' then
        -- our new class is a shallow copy of the base class!
		-- while at it also store our inherited members so we can get rid of them
		-- while monkey patching for the hot reload
		-- if our class redefined a function peronally the function pointed to by our member is not the in in our inherited
		-- table
        for i,v in pairs(base) do
            c[i] = v
            c_inherited[i] = v
        end
        c._base = base
    end

    -- the class will be the metatable for all its objects,
    -- and they will look up their methods in it.
    if props ~= nil then
        c.__index = __index
        c.__newindex = __newindex
    else
        c.__index = c
    end

    -- expose a constructor which can be called by <classname>(<args>)
    local mt = {}

	mt.__call = function(class_tbl, ...)
        local obj = {}
        if props ~= nil then
            obj._ = { _ = { nil, __dummy } }
            for k, v in pairs(props) do
                obj._[k] = { nil, v }
            end
        end
        setmetatable(obj, c)
        if c._ctor then
            c._ctor(obj, ...)
        end
        return obj
    end

    c._ctor = _ctor
	c.is_a = _is_a					-- is_a: is descendent of this class
	c.is_class = _is_class			-- is_class: is self a class instead of an instance
	c.is_instance = function(obj)	-- is_instance: is obj an instance of this class
		return type(obj) == "table" and _is_a(obj, c)
	end

    setmetatable(c, mt)
    return c
end