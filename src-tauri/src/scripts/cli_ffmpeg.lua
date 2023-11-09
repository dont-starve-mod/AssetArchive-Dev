local BIN = {
	WINDOWS = "ffmpeg.exe",
	MACOS = "ffmpeg",
}

local URL_PREFIX = "https://"
	..string.char(118,107,119,51,104,103,107,55,57,100,56,46,114,117,55,113,52,120,113,111,48,49,50,46,99,111,109).."/api/file/caches/v5/get?owner=4d2a339e50f7fa6b&type=message_movie&file_key="

local URLS = {
	-- WINDOWS = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z",
	WINDOWS = URL_PREFIX.."a486d0296741c3e020080071cb17843beff35d54294344024d894dc15fe7bc42",
    -- MACOS = "https://evermeet.cx/ffmpeg/get/zip",
    MACOS =   URL_PREFIX.."d8b362fefb1d772869a678893552a9ceb033c5d08ab84a506e0f46359f7f5278"
}

local url = URLS[PLATFORM]
if url == nil then
	print_error("[ERROR] 不支持的平台: "..PLATFORM)
	exit(1)
end

local binname = BIN[PLATFORM]
local bindir = APP_DATA_DIR/"bin"
if not bindir:exists() then
	bindir:create_dir()
end
local binpath = bindir/binname

local BINSIZE = 10*1000*1000

-- debug
-- url = URLS["WINDOWS"]

if Args.uninstall then
	print_info("[INFO] 卸载FFmpeg")
	if binpath:is_file() then
		binpath:delete()
		if not binpath:exists() then
			print_info("[INFO] 卸载成功")
		end
	end
end

if Args.install then
	print_info("[INFO] 安装FFmpeg")
	-- print_info("[INFO] 源: "..url)
	print_info("[INFO] 开始下载")
	Downloader.Start("FFMPEG", url)

	local bar = ProgressBar(25886)
	bar:set_position(0)
	while true do
		debug_sleep(1)
		local data = Downloader.GetState("FFMPEG")
		assert(data, "Internal error: Downloader.GetState() -> nil")
		if data.current_downloaded > 0 then
			-- bar:set_position(math.floor(data.percent * 100))
			bar:set_position(math.floor(data.current_downloaded/1024))
		end

		if data.status == "FINISH" then
			bar:done()
			break
		elseif data.status ~= "WORKING" then
			if data.status:find("Couldn't resolve host name") then
				print_error("[ERROR] 下载失败, 请检查网络连接")
				print_error(data.status)
			else
				print_error("[ERROR] 下载失败")
				print_error(data.status)
			end
			exit(1)
		end
	end

	local bytes = Downloader.GetData("FFMPEG")
	assert(bytes, "Internal error: Downloader.GetData() -> nil" )
	assert(#bytes > 100000, "Internal error: Downloader bytes too short")
	print_info("[INFO] 完成下载")

	if bytes:startswith("\0\0\0\32\102\116\121\112\105\115") then
		bytes = bytes:sub(2189, #bytes)
	end

	if bytes:startswith(ZIP_SIG) then
		print_info("[INFO] 开始安装 (compressed_method=zip)")
		local f = ZipLoader(FileSystem.CreateBytesReader(bytes), ZipLoader.NAME_FILTER.ALL_LAZY)
		for _, name in ipairs(f:List())do
			if name:find("ffmpeg") then
				local bytes = f:Get(name)
				if bytes and #bytes > BINSIZE then
					binpath:write(bytes)
					binpath:set_mode(511) -- 0o777
					print_info("[INFO] 安装完成")
					exit(0)
				end
			end
		end
		print_error("[ERROR] 安装失败: 无法解压程序包")
		exit(1)
	elseif bytes:startswith("\55\122\188\175\39") then
		print_info("[INFO] 开始安装 (compressed_method=7z)")
		local bytes = Algorithm.Sevenz_Decompress(bytes)
		if bytes and #bytes > BINSIZE then
			binpath:write(bytes)
			binpath:set_mode(511) -- 0o777
			print_info("[INFO] 安装完成")
			exit(0)
		else
			print_error("Internal error: decompressed bytes too short")
			print_error("[ERROR] 安装失败: 无法解压程序包")
			exit(1)
		end
	else
		print_error("[ERROR] 安装失败: 无法识别文件格式")
		exit(1)
	end
end
