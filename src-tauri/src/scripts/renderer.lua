local Provider = require "assetprovider".Provider
local smallhash = Algorithm.SmallHash_Impl

local Render = Class(function(self, api_list)
	self.api_list = api_list

	self.facing = nil
	self.bgc = "#00FF00"

	self.symbol_element_cache = {}
end)

local function tohash(v)
	if type(v) == "string" then
		return smallhash(v)
	elseif type(v) == "number" then
		return v
	else
		error("Failed to convert to hash, expect number or string, got "
			..type(v).." ("..tostring(v)..")")
	end
end

local function format(api)
	local s = tostring(api.name)
	local args = {}
	for _,v in ipairs(api.args)do
		if type(v) == "string" or type(v) == "number" or type(v) == "boolean" then
			table.insert(args, json.encode_compliant(v))
		else
			table.insert(args, tostring(v))
		end
	end
	return s.."("..table.concat(args, ", ")..")"
end

function Render:SetRoot(root)
	if root and root:IsValid() then
		self.root = root
	else
		error("Root is invalid: "..tostring(root))
	end

	self.provider = Provider(root)
	self.provider:DoIndex(false)
end

function Render:SetRenderParam(param)
	self.facing = param.facing
	self.bgc = param.bgc
	self.fps = param.fps
end

function Render:Refine()
	print("[Render] refine api list: #("..#self.api_list.. ")")
	local list = {}
	local ignore_list = {}
	local bank, build, animation, mult, add
	local symbol_mult = {}
	local symbol_add  = {}
	for _,v in pairs(table.reverse(self.api_list))do
		local name, args = v.name, v.args
		if name == "SetBank" then
			if bank then
				table.insert(ignore_list, v)
			else
				bank = args[1]
			end
		elseif name == "SetBuild" then
			if build then
				table.insert(ignore_list, v)
			else
				build = args[1]
			end
		elseif name == "SetMultColour" then
			if mult then
				table.insert(ignore_list, v)
			else
				mult = args
			end
		elseif name == "SetAddColour" then
			if add then
				table.insert(ignore_list, v)
			else
				add = args
			end
		elseif name == "PlayAnimation" or name == "SetPercent" or name == "PushAnimation" then
			if animation then
				table.insert(ignore_list, v)
			else
				animation = args[1]
			end
		elseif name == "SetBankAndPlayAnimation" then
			bank = bank or args[1]
			animation = animation or args[2]
		elseif name == "SetSymbolAddColour" then
			local hash = tohash(args[1])
			if symbol_add[hash] then
				table.insert(ignore_list, v)
			else
				symbol_add[hash] = {args[2], args[3], args[4], args[5]}
			end
		elseif name == "SetSymbolMultColour" then
			local hash = tohash(args[1])
			if symbol_mult[hash] then
				table.insert(ignore_list, v)
			else
				symbol_mult[hash] = {args[2], args[3], args[4], args[5]}
			end
		end
	end
	print("[Render] refined, ignore #("..#ignore_list..")")

	local builddata = build and self.provider:GetBuild({name = build})
	if builddata == nil then
		print("Warning: main build not exists: "..tostring(build))
	end
	local animlist = bank and animation and self.provider:GetAnimation({bank = bank, name = animation})
	if animlist == nil then
		print("Warning: animation not exists: ["..tostring(bank).."]"..tostring(animation))
		error("runtime error: animation not exists")
	end
	local anim = nil
	for _,v in ipairs(animlist)do
		if v.facing == self.facing then
			anim = v
			break
		end
	end
	if anim == nil then
		print("Warning: animation facing not exists: "..tostring(self.facing))
		error("runtime error: animation facing not exists")
	end

	return {
		builddata = builddata,
		anim = anim,
		color = { mult = mult, add = add, symbol_mult = symbol_mult, symbol_add = symbol_add },
	}
end

function Render:BuildSymbolSource()
	print("[Render] build symbol source")
	local source_map = {}
	for _,v in ipairs(self.api_list)do
		local name, args = v.name, v.args
		if name == "OverrideSymbol" or name == "OverrideSkinSymbol" then
			local hash = tohash(args[1])
			local buildname, symbol = args[2], args[3]
			local build = self.provider:GetBuild({name = buildname})
			local symboldata = nil
			if build == nil then
				print("Warning: build not exists: "..format(v))
			else
				symboldata = build:GetSymbol(symbol)
				if symboldata == nil then
					print("Warning: symbol not in build: "..format(v))
				end
			end
			if symbol ~= nil then
				source_map[hash] = { buildname = buildname, symboldata = symboldata }
			end
		elseif name == "ClearOverrideSymbol" then
			local hash = tohash(args[1])
			source_map[hash] = nil
		elseif name == "AddOverrideBuild" or name == "ClearOverrideBuild" then
			local buildname = args[1]
			local build = self.provider:GetBuild({name = buildname})
			if build == nil then
				print("Warning: build not exists: "..format(v))
			else
				for k,v in pairs(build.symbol_map)do
					if name:startswith("Add") then
						source_map[k] = { buildname = buildname, symboldata = v }
					else
						source_map[k] = nil
					end
				end
			end
		end
	end

	return source_map
end

function Render:BuildRenderPermission()
	print("[Render] build render permission")
	local skip_render = {
		symbol = {},
		layer = {},
	}
	for _,v in ipairs(self.api_list)do
		local name, args = v.name, v.args
		if name == "ShowSymbol" or name == "HideSymbol"
		  or name == "Show" or name == "Hide"
		  or name == "ShowLayer" or name == "HideLayer" then
		  	local hash = tohash(args[1])
		  	local skip = name:find("Hide")
		  	if name:find("Symbol") then
		  		skip_render.symbol[hash] = skip
		  	else
		  		skip_render.layer[hash] = skip
		  	end
		end
	end
	return skip_render
end

function Render:GetSymbolElement(build, symbol, index)
	if self.symbol_element_cache[build] and
		self.symbol_element_cache[build][symbol] and
		self.symbol_element_cache[build][symbol][index] then
		return self.symbol_element_cache[build][symbol][index]
	end

	local img = self.provider:GetSymbolElement({
		build = build, 
		imghash = symbol, 
		index = index,
		format = "img",
		fill_gap = false,
	})
	assert(img, "Failed to load symbol element: "..build.." -> " .. symbol .. "-" ..index)

	self.symbol_element_cache[build] = self.symbol_element_cache[build] or {}
	self.symbol_element_cache[build][symbol] = self.symbol_element_cache[build][symbol] or {}
	self.symbol_element_cache[build][symbol][index] = img
	return img
end

local function Mult(a, b)
    return {
        a[1]*b[1]+a[2]*b[3],
        a[1]*b[2]+a[2]*b[4],
        a[3]*b[1]+a[4]*b[3],
        a[3]*b[2]+a[4]*b[4],
        a[1]*b[5]+a[2]*b[6]+a[5],
        a[3]*b[5]+a[4]*b[6]+a[6],
    }
end

function Render:Run()
	IpcEmitEvent("render_event", json.encode_compliant{
		state = "start",
	})
	local path = self.path or "1.gif"
	local f = Image.GifWriter(path)
	if f == nil then
		print("[Render] failed to create gif writer")
		return {
			success = false,
			message = "Error: failed to create gif writer",
		}
	end
	f:set_duration(33) -- TODO

	local basic = self:Refine()
	local anim = basic.anim
	local color = basic.color
	local builddata = basic.builddata
	local source_map = self:BuildSymbolSource()
	local skip_render = self:BuildRenderPermission()

	-- loop 1: calculate symbol source and render rect
	local allelements = {}
	for _,frame in ipairs(anim.frame)do
		for _,element in ipairs(frame)do
			table.insert(allelements, element)
			local imghash = element.imghash
			local layerhash = element.layerhash
			if skip_render.symbol[imghash] or skip_render.layer[layerhash] then
				-- skip render, do nothing
			else
				local matrix = element.matrix
				local imgindex = element.imgindex
				-- get symbol source with possible redirection (by `AddOverrideBuild` | `OverrideSymbol`)
				local symboldata = source_map[imghash] and source_map[imghash].symboldata
					or builddata and builddata:GetSymbol(imghash) or nil
				local buildname = source_map[imghash] and source_map[imghash].buildname
					or builddata and builddata.buildname or nil

				if symboldata ~= nil then
					local img = nil
					for _,v in pairs(symboldata.imglist)do
						-- TODO: 可以优化为二分查找
						if v.index <= imgindex then
							img = v
						else
							break
						end
					end
					if img ~= nil then
						element._img = img
						local w, h = img.w, img.h
						local x, y = img.x, img.y
						local m = Affine(unpack(matrix)):ToLinear()
						local x_values = {}
						local y_values = {}
						for _,v in ipairs{
							{x-w/2, y-h/2}, {x-w/2, y+h/2}, 
							{x+w/2, y-h/2}, {x+w/2, y+h/2},
						}do
							local px, py = m:OnPoint(unpack(v))
							table.insert(x_values, px)
							table.insert(y_values, py)
						end
						element._rect = {
							-- left top right bottom
							math.min(unpack(x_values))-1,
							math.min(unpack(y_values))-1,
							math.max(unpack(x_values))+1,
							math.max(unpack(y_values))+1,
						}
						element._source = self:GetSymbolElement(buildname, symboldata.imghash, img.index)
						-- TODO resize to canvas size
					end
				end
			end
		end
	end

	-- loop 2: render elements
	IpcEmitEvent("render_event", json.encode_compliant({
		state = "render_element",
		progress = 0,
	}))
	local framebuffer = {}
	for index, frame in ipairs(anim.frame)do
		local buffer = {} -- each buffer contains several element render rects
		table.insert(framebuffer, buffer) 
		for _,element in ipairs(frame)do
			local img = element._img
			local rect = element._rect
			local source = element._source
			if img ~= nil then
				local matrix = element.matrix
				local px, py = matrix[5], matrix[6]
				local render_width = math.ceil(rect[3]) - math.floor(rect[1])
				local render_height = math.ceil(rect[4]) - math.floor(rect[2])
				local pos_int = { 
					math.modf(rect[1] + px),
					math.modf(rect[2] + py),
					nil,
				}
				local pos_decimal = {
					select(2, math.modf(rect[1])),
					select(2, math.modf(rect[2])),
				}
				local m1 = {1, 0, 0, 1, img.x-img.w/2, img.y-img.h/2} -- anchor
				local m2 = {matrix[1], matrix[3], matrix[2], matrix[4], 0, 0} -- linear transformation part
				local m3 = {1, 0, 0, 1, -rect[1]+pos_decimal[1]*0, -rect[2]+pos_decimal[2]*0} -- place to small render rect
				local m = Mult(m3, (Mult(m2, m1)))
				m[2], m[3] = m[3], m[2] -- TODO: fix mult function

				local small_img = source:affine_transform(render_width, render_height,
					m, Image.BILINEAR)
				table.insert(buffer, {
					small_img = small_img,
					pos_int = pos_int,
					render_width = render_width,
					render_height = render_height,
					z_index = element.z_index,
					mult = {color.mult, color.symbol_mult[element.imghash]},
					add  = {color.add, color.symbol_add[element.imghash]},
				})
			end
		end
		IpcEmitEvent("render_event", json.encode_compliant({
			state = "render_element",
			progress = index / #anim.frame
		}))
	end

	-- loop 3: calculate global render region
	local x_values = {}
	local y_values = {}
	for _, buffer in ipairs(framebuffer)do
		for _, data in ipairs(buffer)do
			local rect = data.rect
			local pos_int = data.pos_int
			table.insert(x_values, pos_int[1])
			table.insert(x_values, pos_int[1]+data.render_width)
			table.insert(y_values, pos_int[2])
			table.insert(y_values, pos_int[2]+data.render_height)
		end
	end
	local left = math.floor(Algorithm.Min(x_values))
	local right = math.ceil(Algorithm.Max(x_values))
	local top = math.floor(Algorithm.Min(y_values))
	local bottom = math.ceil(Algorithm.Max(y_values))
	local width = right - left
	local height = bottom - top
	if width == 0 or height == 0 then
		print("[Render] size is 0x0, finish")
		return {
			success = false,
			message = "canvas size is 0x0"
		}
	end
	print("[Render] region:", left, top, right, bottom)

	-- loop 4: render the full canvas
	if #framebuffer == 0 then
		print("[Render] animation frame is 0, finish")
		return {
			success = false,
			message = "animation frame is 0"
		}
	end
	IpcEmitEvent("render_event", json.encode_compliant({
		state = "render_canvas",
		progress = 0,
	}))
	local background = string.rep(
		self.bgc == "transparent" and "\0\0\0\0" or string.char(HexToRGB(self.bgc)).."\255",
		width* height)
	local bar = ProgressBar(#framebuffer)
	for index, buffer in ipairs(framebuffer)do
		table.sort(buffer, function(a,b) return a.z_index > b.z_index end)
		local canvas = Image.From_RGBA(background, width, height)
		for _, data in ipairs(buffer)do
			local small_img = data.small_img
			local pos_int = data.pos_int
			local filter = self:GetFilter(data)
			small_img:apply_filter(filter)
			canvas:paste(small_img, pos_int[1]-left, pos_int[2]-top)
		end
		bar:set_position(index)
		IpcEmitEvent("render_event", json.encode_compliant({
			state = "render_canvas",
			progress = index/#framebuffer,
		}))
		f:encode(canvas)
	end

	f:drop()
	IpcEmitEvent("render_event", json.encode_compliant({
		state = "finish",
		path = self.path,
	}))
end

function Render:GetFilter(data)
	local mult = data.mult
	local multRGBA = {1, 1, 1, 1}
	for _,v in pairs(mult)do
		for i, c in ipairs(v)do
			multRGBA[i] = multRGBA[i] * c
		end
	end
	local add = data.add
	local addRGB = {0, 0, 0, 0}
	for _,v in pairs(add)do
		for i, c in ipairs(v)do
			addRGB[i] = addRGB[i] + c* 255* v[4]
		end
	end
	local filter = Image.Filter({
		function(r) return math.clamp(r* multRGBA[1] + addRGB[1], 0, 255) end,
		function(g) return math.clamp(g* multRGBA[2] + addRGB[2], 0, 255) end,
		function(b) return math.clamp(b* multRGBA[3] + addRGB[3], 0, 255) end,
		function(a) return math.clamp(a* multRGBA[4], 0, 255) end
	})
	return filter
end

local function test()
	local r = Render({
		{name="SetBank", args = {"wilson"}},
		{name="SetBuild", args = {"wendy"}},
		{name="PlayAnimation", args={"run_loop"}},
		{name="OverrideSymbol", args={"face", "wolfgang", "face"}},
		{name="OverrideSymbol", args={"swap_object", "swap_ham_bat", "swap_ham_bat"}},
		{name="Hide", args={"arm_normal"}},
		{name="HideSymbol", args={"face-"}},
		{name="SetSymbolMultColour", args={"headbase",1,0.25,0.25,1}},
		{name="Hide", args={"head_hat"}},
		-- {name="SetMultColour", args={1,1,1,0.2}},
		-- {name="SetAddColour", args={1,0,0,1}},

	})
	local DST_DataRoot = require "assetprovider".DST_DataRoot
	r:SetRoot(DST_DataRoot())
	-- r.bgc = "transparent"
	r.facing = 8
	r:Run()
end

-- test()

return Render