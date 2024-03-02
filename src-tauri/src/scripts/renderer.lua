local Provider = require "assetprovider".Provider
local smallhash = Algorithm.SmallHash_Impl

local Render = Class(function(self, api_list)
	self.api_list = api_list

	self.facing = nil
	self.facing_index = nil
	self.bgc = "#00FF00"

	self.symbol_element_cache = {}
	self.filter = {}

	self.path = nil
	self.format = "auto"
	self.scale = nil
	self.rate = nil
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
	if self.skip_index and self.provider.root == GLOBAL.prov.root then
		self.provider.index = GLOBAL.prov.index
	else
		self.provider:DoIndex(false)
	end
end

function Render:SetRenderParam(param)
	self.facing = param.facing
	self.bgc = param.bgc
	self.rate = param.rate
	self.format = param.format
	self.scale = param.scale
	self.skip_index = param.skip_index
	self.current_frame = param.current_frame

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
	for i,v in ipairs(animlist)do
		if v.facing == self.facing or i == self.facing_index then
			anim = v
			break
		end
	end
	if anim == nil then
		print("Warning: animation facing not exists: "..tostring(self.facing))
		print("To get animation by facing index, using #1, #2, ...")
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
		resize = true,
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

function Render:TryInterrupt()
	if IpcInterrupted() then
		return error(ERROR.IPC_INTERRUPTED)
	end
end

function Render:Run()
	IpcEmitEvent("render_event", json.encode_compliant{
		session_id = self.session_id,
		state = "start",
	})
	local path = assert(self.path, "export path not provided")
	if type(path) == "string" then
		path = FileSystem.Path(path)
	end

	local format = self.format:lower()
	if format == "auto" then
		for _, suffix in ipairs{ "gif", "mp4", "mov" }do
			if path:check_extention(suffix) then
				format = suffix
				break
			end
		end
	end
	assert(format ~= "auto", "Failed to infer export format from file path: "..path:as_string())
	assert(table.contains({"gif", "mp4", "mov", "png", "snapshot"}, format), "Invalid export format: "..format)
	
	if format == "png" then
		assert(path:is_dir(), "Error: png sequence must export to a directory")
	else
		if format == "snapshot" then
			if self.current_frame == nil then
				error("self.current_frame not provided")
			end
		elseif not FFmpegManager:IsAvailable() then
			IpcEmitEvent("render_event", json.encode_compliant{
				session_id = self.session_id,
				state = "error",
				message = "FFmpeg not installed"
			})
			return
		end
		if not path:is_file() then
			path:write("\0\0\0") -- test if target path is writable
		end
	end

	local basic = self:Refine()
	local anim = basic.anim
	local color = basic.color
	local builddata = basic.builddata
	local source_map = self:BuildSymbolSource()
	local skip_render = self:BuildRenderPermission()

	local frame_list = {}
	for i, v in ipairs(anim.frame)do
		if format ~= "snapshot" or i == self.current_frame + 1 then
			table.insert(frame_list, v)
		end
	end

	assert(#frame_list > 0, "Frame list is empty")

	-- loop 1: calculate symbol source and render rect
	local allelements = {}
	for _,frame in ipairs(frame_list)do
		self:TryInterrupt()
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
		session_id = self.session_id,
		state = "render_element",
		progress = 0,
	}))
	local framebuffer = {}
	local element_tasks = {}
	for index, frame in ipairs(frame_list)do
		self:TryInterrupt()
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
				local pos_global = {
					px + rect[1],
					py + rect[2],
				}
				local pos_int = { 
					math.floor(pos_global[1]),
					math.floor(pos_global[2]),
				}
				local pos_decimal = {
					pos_global[1] - math.floor(pos_global[1]),
					pos_global[2] - math.floor(pos_global[2]),
				}
				local m1 = {1, 0, 0, 1, img.x-img.w/2, img.y-img.h/2} -- anchor
				local m2 = {matrix[1], matrix[3], matrix[2], matrix[4], 0, 0} -- linear transformation part
				local m3 = {1, 0, 0, 1, -rect[1]+pos_decimal[1], -rect[2]+pos_decimal[2]} -- place to small render rect
				local m = Mult(m3, (Mult(m2, m1)))
				m[2], m[3] = m[3], m[2] -- TODO: fix mult function

				-- local small_img = source:affine_transform(render_width, render_height,
				-- 	m, Image.BILINEAR)

				local key = "task-"..getaddr(source).."("..render_width.."x"..render_height..")"..
					table.concat(m, "+")
				local filter, filter_key = self:GetFilter({					
					mult = {color.mult, color.symbol_mult[element.imghash]},
					add  = {color.add, color.symbol_add[element.imghash]},
				})
				if filter_key ~= nil then
					key = key .. "filter:" .. filter_key
				end
				element_tasks[key] = {
					render_width = render_width,
					render_height = render_height,
					img = source,
					matrix = m,
					filter = filter,
				}
				table.insert(buffer, {
					-- small_img = small_img,
					small_img_id = key,
					pos_int = pos_int,
					render_width = render_width,
					render_height = render_height,
					z_index = element.z_index,
					-- mult = {color.mult, color.symbol_mult[element.imghash]},
					-- add  = {color.add, color.symbol_add[element.imghash]},
				})
			end
		end
		-- IpcEmitEvent("render_event", json.encode_compliant({
		-- 	session_id = self.session_id,
		-- 	state = "render_element",
		-- 	progress = index / #frame_list
		-- }))
	end

	-- loop 2.1: run the multithreaded renderer
	-- element_tasks["@thread"] = 1
	-- element_tasks["@resampler"] = Image.NEAREST
	element_tasks["@progress"] = function(current, _, percent)
		if current % 100 == 0 then
			IpcEmitEvent("render_event", json.encode_compliant({
				session_id = self.session_id,
				state = "render_element",
				progress = percent,
			}))
		end
	end
	Image.MultiThreadedTransform(element_tasks)

	IpcEmitEvent("render_event", json.encode_compliant{
		session_id = self.session_id,
		state = "render_element",
		progress = 1,
	})

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
	-- h264 encoder need even size
	if width % 2 == 1 then width = width + 1 end
	if height % 2 == 1 then height = height + 1 end
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
		session_id = self.session_id,
		state = "render_canvas",
		progress = 0,
	}))
	self:TryInterrupt()

	local enc = nil
	local png_dir = path
	local png_path = nil
	if format == "mov" or format == "mp4" or format == "gif" then
		if format == "mov" then
			self.scale = 1.0 -- mov format always use full scale
		end
		enc = FFcore.Encoder {
			bin = FFmpegManager:TryGetBinPath(),
			path = path:as_string(),
			format = format,
			scale = self.scale or 1.0,
			width = width,
			height = height,
			rate = self.rate or anim.framerate or error("Failed to get export framerate"),
		}
	elseif format == "png" then
		self.scale = 1.0 -- png format always use full scale
		for i = 1, 1000 do
			png_dir = path/("export_frames_"..i)
			if not png_dir:exists() then
				assert(png_dir:create_dir(), "Failed to create export dir: "..png_dir:as_string())
				break
			end
		end

		enc = {
			index = 0,
			encode_frame = function(self, img)
				local name = string.format("%05d.png", self.index)
				local out = (png_dir/name):as_string()
				img:save(out)

				if png_path == nil then
					png_path = out -- use the first frame to display
				end

				self.index = self.index + 1
			end,
			wait = function() end, -- dummy
		}
	elseif format == "snapshot" then
		enc = {
			encode_frame = function(self, img)
				img:save(path:as_string())
			end,
			wait = function() end, -- dummy
		}
	end

	local background = string.rep(
		self.bgc == "transparent" and "\0\0\0\0" or string.char(HexToRGB(self.bgc)).."\255",
		width* height)
	local bar = ProgressBar(#framebuffer)
	for index, buffer in ipairs(framebuffer)do
		self:TryInterrupt()
		table.sort(buffer, function(a,b) return a.z_index > b.z_index end)
		local canvas = Image.From_RGBA(background, width, height)
		for _, data in ipairs(buffer)do
			-- local small_img = data.small_img
			local small_img = assert(element_tasks[data.small_img_id],
				"internal error: element render task failed").img:clone()
			local pos_int = data.pos_int
			canvas:paste(small_img, pos_int[1]-left, pos_int[2]-top)
		end
		bar:set_position(index)
		IpcEmitEvent("render_event", json.encode_compliant({
			session_id = self.session_id,
			state = "render_canvas",
			progress = math.min(.99, index/#framebuffer),
		}))
		enc:encode_frame(canvas)
	end

	enc:wait()  -- wait ffmpeg subprocess to finish and shutdown
	bar:done()

	IpcEmitEvent("render_event", json.encode_compliant({
		session_id = self.session_id,
		state = "finish",
		path = png_path or self.path,
	}))
end

-- local function FormatList(v)
-- 	return string.format("%.6f/%.6f/%.6f/%.6f",
-- 			unpack(v))
-- end

function Render:GetFilter(data)
	local key = {}
	local mult = data.mult
	local multRGBA = {1, 1, 1, 1}
	for _,v in pairs(mult)do
		for i, c in ipairs(v)do
			multRGBA[i] = multRGBA[i] * c
		end
		table.insert(key, "m-"..getaddr(v))
	end
	local add = data.add
	local addRGB = {0, 0, 0, 0}
	for _,v in pairs(add)do
		for i, c in ipairs(v)do
			addRGB[i] = addRGB[i] + c* 255* v[4]
		end
		table.insert(key, "a-"..getaddr(v))
	end

	key = table.concat(key, ",")
	if key == "" then
		return nil
	elseif self.filter[key] ~= nil then
		return self.filter[key], key
	else
		local filter = Image.Filter({
			function(r) return math.clamp(r* multRGBA[1] + addRGB[1], 0, 255) end,
			function(g) return math.clamp(g* multRGBA[2] + addRGB[2], 0, 255) end,
			function(b) return math.clamp(b* multRGBA[3] + addRGB[3], 0, 255) end,
			function(a) return math.clamp(a* multRGBA[4], 0, 255) end
		})
		self.filter[key] = filter
		return filter, key
	end
end

local function test()
	local r = Render({
		{name="SetBank", args = {"wilson"}},
		{name="SetBuild", args = {"wendy"}},
		{name="PlayAnimation", args={"idle_loop"}},
		{name="OverrideSymbol", args={"headbase", "wendy", "headbase"}},
		-- {name="OverrideSymbol", args={"swap_object", "swap_ham_bat", "swap_ham_bat"}},
		{name="Hide", args={"arm_normal"}},
		{name="HideSymbol", args={"face-"}},
		-- {name="SetSymbolMultColour", args={"headbase",1,0.25,0.25,1}},
		{name="Hide", args={"head_hat"}},
		{name="SetMultColour", args={1,1,1,1}},
		{name="SetAddColour", args={1,0,0,1}},

	})
	local DST_DataRoot = require "assetprovider".DST_DataRoot
	r:SetRoot(DST_DataRoot())
	r.path = "/Users/wzh/Downloads/测试/2.mp4"
	r.format = "mp4"
	-- r.path = "/Users/wzh/Downloads/测试/2.gif"
	-- r.format = "gif"
	-- r.bgc = "transparent"
	r.facing = 8
	r:Run()
	exit()
end

-- test()

return Render
