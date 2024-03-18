-- app cli handlers

if Args == false then
	rawset(_G, "print_debug", print)
	rawset(_G, "print_info", print)
	rawset(_G, "print_error", print)
	return
end

local verbose = tonumber(Args.verbose)
print_debug = verbose >= 2 and print or function() end
print_info  = verbose >= 1 and print or function() end
print_error = verbose >= 0 and print or function() end

local env = {}

local function load_root()
	print_info("[INFO] 加载游戏资源目录")
	local DST_DataRoot =  require "assetprovider".DST_DataRoot
	local path = Args.game_data_directory
	local root = DST_DataRoot(path)
	if root:IsValid() then
		print_info("[INFO] 加载成功, 路径: "..tostring(root:as_string()))
		env.root = root
	elseif path ~= nil then
		print_error("[ERROR] 游戏资源目录加载失败, 请检查提供的路径是否有效: "..path)
		exit(1)
	else
		print_error("[ERROR] 游戏资源目录加载失败, 请显式指定路径 (--game-data-directory <PATH>) 或以图形界面模式启动程序并设置路径")
		exit(1)
	end
end

local function render_animation()
	print_info("[INFO] 开始渲染动画")
	local root = env.root
	local provider = require "assetprovider".Provider(root)
	provider:DoIndex(Args.force_index)

	-- build
	local build = provider:GetBuild({name = Args.build})
	if build == nil then
		print_info("[INFO] 材质不存在: "..Args.build)
	else
		print_debug("[DEBUG] 材质 <"..Args.build.."> 在资源文件: "..provider.index:GetBuildFile(Args.build))
	end

	-- animation
	local animation_name = Args.animation
	local animation = provider:GetAnimation({bank = Args.bank, name = Args.animation})
	if animation == nil then
		print_error("[ERROR] 动画不存在: "..Args.bank.." - "..Args.animation)
		exit(1)
	else
		--
	end
end

local function compile()
	local Provider =  require "assetprovider".Provider
	local root = env.root
	local prov = Provider(root)
	prov:DoIndex(Args.force_index)
	prov:ListAsset()
	env.prov = prov

	-- TODO: --force-reindex
	if not Args.skip_analyzing then
		require("compiler.amain").main(env)
	end
	-- require("compiler.cmain").main(env)

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
