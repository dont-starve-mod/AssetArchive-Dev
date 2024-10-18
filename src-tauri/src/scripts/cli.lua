-- app cli handlers

if Args == false then
	rawset(_G, "print_debug", print)
	rawset(_G, "print_info", print)
	rawset(_G, "print_error", print)
	input = nil
	return
end

local verbose = tonumber(Args.verbose)
print_debug = verbose >= 2 and print or function() end
print_info  = verbose >= 1 and print or function() end
print_error = verbose >= 0 and print or function() end

local env = {}

local function load_root()
	local DST_DataRoot =  require "assetprovider".DST_DataRoot
	local path = Args.game_data_directory
	local root = DST_DataRoot(path)
	if root:IsValid() then
		print_info("[INFO] 加载成功, 路径: "..(root:as_string()))
		env.root = root
	elseif path ~= nil then
		print_error("[ERROR] 游戏资源目录加载失败, 请检查提供的路径是否有效: "..path)
		exit(1)
	else
		print_error("[ERROR] 游戏资源目录加载失败, 请显式指定路径 (--game-data-directory <PATH>) 或以图形界面模式启动程序并设置路径")
		exit(1)
	end
end

local function input_or_exit(message, ...)
	local result = input(message.." ", ...)
	if string.lower(result) == "y" then
		return true
	else
		exit(0)
	end
end

local function render_animation()
	local root = env.root
	local provider = require "assetprovider".Provider(root)
	provider:DoIndex(Args.force_index)

	local build = provider:GetBuild({name = Args.build})
	if build == nil then
		print_info("[INFO] build not valid: "..Args.build)
	else
		print_debug("[DEBUG] build <"..Args.build.."> loaded by asset: "..provider.index:GetBuildFile(Args.build))
	end

	local animation_name = Args.animation
	local animation_list = provider:GetAnimation({bank = Args.bank, name = Args.animation})
	if animation_list == nil then
		print_error("[ERROR] animation not valid: "..Args.bank.." - "..Args.animation)
		exit(1)
	elseif #animation_list == 0 then
		print_error("[ERROR] animation list is empty: "..Args.bank.." - "..Args.animation)
		exit(1)
	end

	local animation = animation_list[1]
	if type(Args.facing) == "string" then
		if Args.facing:startswith("#") then
			local index = Args.facing:sub(2, 10)
			local index_number = tonumber(index)
			if index_number == nil or math.floor(index_number + 0.5) ~= index_number then
				print_error("[ERROR] facing index must be an integer, eg: #1, #2, #5, ...")
				exit(1)
			elseif animation_list[index_number + 1] == nil then
				local facing_list = {}
				for i,v in ipairs(animation_list)do
					table.insert(facing_list, string.format("#%d\tName = %s\tByte = %d\tFrames = %d", 
						i - 1, Facing.FromByte(v.facing):GetAlias(), v.facing, v.numframes))
				end

				print_error("[ERROR] facing index out of range (0–"..(#animation_list - 1)..")")
				print_error("[NOTE] animation "..Args.bank.." - "..Args.animation.." has "..#animation_list.." facing(s):\n"
					..table.concat(facing_list, "\n"))
				exit(1)
			else
				animation = animation_list[index_number + 1]
			end
		else
			local code = tonumber(Args.facing)
			if code == nil then
				local facing = Facing.FromAlias(Args.facing)
				if facing.invalid then
					print_error("[ERROR] failed to parse facing: "..Args.facing)
					print_error("[NOTE] valid facing param: side, up, down, ... as string; 0, 1, 3, ... as byte; #1, #2, #5, ... as index;")
					exit(1)
				else
					code = facing.byte
				end
			end

			-- find animation by bit and
			for _,v in ipairs(animation_list)do
				if v.facing == code then
					animation = v
					break
				elseif BitAnd(v.facing, code) then
					animation = v
				end
			end
		end
	end

	print_info("[INFO] using animation: "..Args.bank.." - "..Args.animation
		.." @"..tostring(Facing.FromByte(animation.facing)))

	local Renderer = require "renderer"
	local cmds = {
		{name = "SetBuild", args = {Args.build}},
		{name = "SetBank", args = {Args.bank}},
		{name = "PlayAnimation", args = {Args.animation}},
	}

	-- TODO:fix priority
	local function ListWithIndices(name, list_args)
		local values = Args:list(name)
		local indices = Args:list_indices(name)
		assert(#values == #indices, "num values("..#values..") must be same with indices("..#indices..")")
		local result = {}
		for i, ind in ipairs(indices)do
			if not list_args then
				table.insert(result, {i = ind, v = values[i]})
			elseif #result > 0 and result[#result].i == ind - 1 then
				-- append
				result[#result].i = ind
				table.insert(result[#result].v, values[i])
			else
				-- new
				table.insert(result, {i = ind, v = {values[i]}})
			end
		end
		return result
	end

	-- override-build
	for _,v in ipairs(Args:list("override_build"))do
		table.insert(cmds, {name = "AddOverrideBuild", args = {v}})
	end

	-- hide-symbol
	for _,v in ipairs(Args:list("hide_symbol"))do
		table.insert(cmds, {name = "HideSymbol", args = {v}})
	end

	-- hide-layer
	for _,v in ipairs(Args:list("hide_layer"))do
		table.insert(cmds, {name = "HideLayer", args = {v}})
	end

	local function ParseColorOrExit(c)
		local success, r,g,b,a = pcall(ParseColorString, c)
		if success then
			return r,g,b,a
		else
			print_error("[ERROR] failed to parse color specifier: "..c)
			exit(1)
		end
	end

    -- mult-color
    if Args.mult_color then
    	local r,g,b,a = ParseColorOrExit(Args.mult_color)
    	table.insert(cmds, {name = "SetMultColour", args = {r/255, g/255, b/255, a/255}})
    end

    -- add-color
    if Args.add_color then
    	local r,g,b,a = ParseColorOrExit(Args.add_color)
    	table.insert(cmds, {name = "SetAddColour", args = {r/255, g/255, b/255, a/255}})
    end

    -- override-symbol
    for _,args in ipairs(ListWithIndices("override_symbol", true))do
    	local args = args.v
    	args[3] = args[3] or args[1]
    	table.insert(cmds, {name = "OverrideSymbol", args = args})
    end

    -- symbol-mult-color
    for _,args in ipairs(ListWithIndices("symbol_mult_color", true))do
    	local args = args.v
    	local r,g,b,a = ParseColorOrExit(args[2])
    	table.insert(cmds, {name = "SetSymbolMultColour", args = {args[1], r/255, g/255, b/255, a/255}})
    end

    -- symbol-add-color
    for _,args in ipairs(ListWithIndices("symbol_add_color", true))do
    	local args = args.v
    	local r,g,b,a = ParseColorOrExit(args[2])
    	table.insert(cmds, {name = "SetSymbolAddColour", args = {args[1], r/255, g/255, b/255, a/255}})
    end

	-- clear-override-build TODO:
	-- clear-override-symbol TODO:

	local r = Renderer(cmds)
	r.facing = animation.facing
	r.format = Args.format
	r.rate = Args.fps

	local color = { ParseColorOrExit(Args.background_color or "transparent") }
	r.bgc_string = string.char(unpack(color))

	local output = Args.output
	local extension = output and output:sub(-3)
	if r.format == nil and output ~= nil then
		if extension == "gif" or extension == "mp4" or extension == "mov" then
			r.format = extension
		else
			print_error("[ERROR] failed to determine file format from output path, consider set it explicitly")
			exit(1)
		end
	end
	if output == nil then
		if r.format ~= "png" then
			output = APP_WORK_DIR/("export."..r.format)
		else
			output = APP_WORK_DIR/"export"
		end
	else
		-- check if format and file extension match
		if extension ~= r.format then
			input_or_exit("output file extension `"..extension.."` do not match the format `"..r.format.."`, continue? (y/n)")
		end
	end

	local info = FileSystem.GetInfo(output)
	if info.exists then
		if r:IsFileOutput() then
			if info.is_dir then
				print_error("[ERROR] output path is a directory: "..output)
				exit(1)
			elseif info.is_file and not Args.override then
				input_or_exit("output file exists, override the old one? (y/n)")
			end
		else
			--
		end
	end

	print_debug("[DEBUG] start rendering animation")
	r.path = output
	r:SetRoot(root)
	r:Run()

	exit(0)
end

local function compile()
	local Provider =  require "assetprovider".Provider
	local root = env.root
	local prov = Provider(root)
	local rImage = Image
	prov:DoIndex(Args.force_index)
	prov:ListAsset()
	env.prov = prov

	-- TODO: --force-reindex
	if not Args.skip_analyzing then
		require("compiler.amain").main(env)
	end
	
	require("compiler.cmain").main(env)

	-- override Image from @widgets/image.lua
	Image = rImage
	require("compiler.preview_gen").main(env)
end

local function install_ffmpeg()
	require "cli_ffmpeg"
end

local function cli_main()
	local name = Args.subcommand
	if name == "render-animation" then
		load_root()
		render_animation()
	elseif name == "compile" then
		load_root()
		compile()
	elseif name == "install-ffmpeg" then
		install_ffmpeg()
	elseif name == "dummy" then
		load_root()
	end

	exit()
end

cli_main()