local STYLE = {
	h1 = true,
	h2 = true,
	h3 = true,
	h4 = true,
	p = true,
	hr = true,
	br = true,
	a = true,
	b = true,
	i = true,
	u = true,
	color = true,
}

local STYLE_ALIAS = {
	link = "a",
	strong = "b",
	italic = "i",
	underline = "u",
}

for k in pairs(STYLE_ALIAS)do
	STYLE[k] = true
end

local function ValidateStyle(name)
	name = STYLE_ALIAS[name] or name
	return STYLE[name] == true and name or print("Invalid style name: "..name)
end

local function DumpStyle(name, param)
	local name = ValidateStyle(name)
	if name == "color" then
		return "c-"..json.encode_compliant(param)
	end
	return name
end

local RichText = Class(function(self, text_or_param)
	self.prev = nil -- prev node
	self.next = nil -- next node

	if type(text_or_param) == "string" then
		self.text = text_or_param
		self.style = {}
	elseif type(text_or_param) == "table" then
		self.text = text_or_param.text or ""
		self.style = self:ParseStyleParam(text_or_param)
	end
end)

RichText.is_rich_text = true

function RichText:__call(text)
	-- a call on RichText override its content
	if self.text ~= "" then
		print("Warning: try to change content of a non-empty RichText")
	end
	self.text = text
	return self
end

function RichText:ParseStyleParam(param)
	if param[1] ~= nil and param.name == nil then
		param.name = param[1]
		param[1] = nil
	end
	local name = assert(param.name, "Style param must contain key `name|[1]` as style name")
	if name == "color" then
		assert(param[1] or param.closed, "Style color must contain key `[1]` as color value")
	end
	param.text = nil
	return param
end

function RichText:FindHeadNode()
	local node = self.prev
	if node == nil then
		return self
	end

	for i = 1, 1000 do
		if node.prev ~= nil then
			node = node.prev
		end
	end
	return assert(node.prev == nil, "Failed to reach head node, inf loop?") and node
end

function RichText:__concat(rhs)
	if type(rhs) == "number" then
		return self:__concat(tostring(rhs))
	end
	if type(rhs) == "string" then
		rhs = RichText(rhs)
	end
	
	assert(type(rhs) == "table")
	if rhs.is_ctor_helper then
		rhs = rhs()
	end
	assert(rhs:is_a(RichText))
	assert(not self.is_html and not rhs.is_html, "Cannot concat <HTML> with other RichText")
	self.next = rhs
	assert(rhs.prev == nil, "RichText error: repeated concat operations: "..tostring(rhs))
	rhs.prev = self
	return self
end

function RichText:Flatten()
	local node = self:FindHeadNode()
	if node ~= self then
		print("Warning: head node advanced")
	end

	local stack = {} -- some nonclosed styles TODO: impl
	local result = {}

	for i = 1, 100 do -- a strict checker
		table.insert(result, {
			text = node.text,
			style = node.style,
			anydata = node.anydata,
		})
		node = node.next
		if node == nil then
			break
		end
	end

	if node ~= nil then
		print("Warning: RichText too long")
		self:DebugPrintNode()
		error()
	end

	return result
end

function RichText:FlattenWithPlain()
	local data = self:Flatten()
	local plain = {}
	for _,v in ipairs(data)do
		if v.text and v.text ~= "" then
			table.insert(plain, v.text)
		end
	end
	return data, table.concat(plain, " ")
end

function RichText:DebugPrintNode()
	local node = self:FindHeadNode()
	if node ~= self then
		print("Warning: head node advanced")
	end
	for i = 1, 1000 do
		print(node)
		node = node.next
		if node == nil then
			break
		end
	end
end

function RichText:__tostring()
	if self.anydata then
		return string.format("Any<%s>", json.encode(self.anydata))
	elseif next(self.style) then
		return string.format("%s - %s", self.text, json.encode(self.style))
	else
		return self.text
	end
end

local RichTextCtorHelper = Class(function(self, name, opts)
	self.is_ctor_helper = true
	self.stylename = name

	if opts then
		for k,v in pairs(opts)do
			self[k] = v
		end
	end
end)

function RichTextCtorHelper:__call(text_or_param)
	if type(text_or_param) == "string" then
		text_or_param = {name = self.stylename, text = text_or_param}
	elseif type(text_or_param) == "table" then
		text_or_param.name = self.stylename
	elseif type(text_or_param) == "nil" then
		text_or_param = {name = self.stylename}
	end
	if self.nonclosed then
		text_or_param.nonclosed = true
	end
	return RichText(text_or_param)
end

local RichTextCtorHelper_CloseStyle = Class(RichTextCtorHelper, function(self, name)
	RichTextCtorHelper._ctor(self, name, { closed = true })
end)

function RichTextCtorHelper_CloseStyle:__call(text_or_param)
	assert(text_or_param == nil, "Closed style accept no param")
	return RichText({name = self.stylename, closed = true})
end

for k in pairs(STYLE)do
	RichText[k] = RichTextCtorHelper(k)
	RichText["_"..k] = RichTextCtorHelper(k, { nonclosed = true })
	RichText[k.."_"] = RichTextCtorHelper_CloseStyle(k)
end

RichText.asset_link = function(param)
	-- string | { id: string, label?: string }
	if type(param) == "string" then
		param = {id = param}
	end
	local r = RichText("")
	r.anydata = param
	r.anydata.is_asset_link = true
	return r
end

RichText.any = function(param)
	local r = RichText("")
	r.anydata = param
	return r
end

-- Try not to use this
RichText.html = function(text)
	local r = RichText(text)
	r.is_html = true
	return r
end

RichText.HTML = RichText.html

RichText.ToPlainText = function(value)
	if type(value) == "string" then
		return value
	elseif type(value) == "table" and value.is_rich_text then
		return value:Flatten()
	else
		error("Failed to convert to plain text: "..json.encode(value))
	end
end

local function Examples()
	local r = RichText
	local a = r "hello" .. r.h1 "Title" .. r.p "This is richtext!"
	local b = r{"bold"} "Don't Starve Together" .. r{"italic"} "by" .. "Klei Entertainment"
	local c = r.color{"red"} "It's red." .. r.color{"green"} "And it's green."
	local d = r.any {component = "Preview", props = {name = "wilson"}} .. r.br() .. r.hr() .. "Some text below..."
	local e = r.color{"red", nonclosed = true} "Do not close style field!" .. r.b "It's red and bold" .. 
		r.color{closed = true} .. "It's normal. (color style is closed)"
	local f = r._color{"red"} "Do not close style field! (sugar)" .. r.b "It's red and bold." .. 
		r.color_() .. "It's normal. (color style is closed)"

	for _,v in ipairs{a, b, c, d, e, f} do
		print("==========")
		v:DebugPrintNode()
		print()
	end

	-- don't do this!
	local website = r{"a", link = "https://space.bilibili.com/209631439/"} "subscribe my channel"
	local t1 = r"Link1: " .. website
	-- local t2 = r"Link2: " .. website  -- error, can not reuse RichText
	-- local t3 = r"Link3: " .. website  -- error, can not reuse RichText
	
	-- instead, make a new copy:
	local website = function() return r{"a", link = "https://space.bilibili.com/209631439/"} "subscribe my channel" end
	local t1 = r"Link1: " .. website()
	local t2 = r"Link2: " .. website()
	local t3 = r"Link3: " .. website()

	local h = r.HTML"<p>Hello world!</p>"
	-- local c = h .. r"Cannot concat"  -- error, can not concat <HTML>
end

-- Examples()

return RichText
