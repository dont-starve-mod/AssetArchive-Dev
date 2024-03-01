require "ffmpeg"

if Args.uninstall then
	print_info("[INFO] Uninstalling FFmpeg")
	local success = FFmpegManager:Uninstall() -- may failed on remove file, ignore it

	local path, type = FFmpegManager:TryGetBinPath("no_warning")
	if type == "CUSTOM" then
		print_info("[NOTICE] You have setup FFmpeg custom path: "..path)
		print_info("[NOTICE] If you want to clear custom path, run: "..
			Args[0].." "..Args.subcommand.." --path \"\"")
	end
	exit(0)
end

if Args.path == nil then -- use auto install
	local path, type = FFmpegManager:TryGetBinPath("no_warning")
	if path ~= nil then
		if type == "AUTO" then
			print_info("[INFO] FFmpeg has been already installed")
		elseif type == "CUSTOM" then
			print_info("[INFO] FFmpeg has been already installed with custom path: "..path)
		end
		exit(0)
	end

	print_info("[INFO] Installing FFmpeg")
	FFmpegManager:StartDownloading()
	local bar = ProgressBar(25886) -- this value is size of FFmpeg installer file (kb)
	bar:set_position(0)
	while true do
		debug_sleep(1)
		local data = Downloader.GetState(FFmpegManager.DOWNLOADER_ID)
		assert(data, "Internal error: Downloader.GetState() is nil")
		if data.current_downloaded > 0 then
			-- bar:set_position(math.floor(data.percent * 100))
			bar:set_position(math.floor(data.current_downloaded/1024))
		end

		if data.status == "FINISH" then
			bar:done()
			break
		elseif data.status ~= "WORKING" then
			if data.status:find("Couldn't resolve host name") then
				print_error("[ERROR] Failed to download, please check your network connection")
				print_error(data.status)
			else
				print_error("[ERROR] Failed to download")
				print_error(data.status)
			end
			exit(1)
		end
	end

	local bytes = Downloader.GetData(FFmpegManager.DOWNLOADER_ID)
	assert(bytes, "Internal error: Downloader.GetData() is nil" )
	assert(#bytes > 100000, "Internal error: Downloader bytes too short")
	print_info("[INFO] Finish downloading, try to install file")
	FFmpegManager:Install(bytes)

	exit(0)
else
	-- use custom install
	if Args.path == "" then
		print_info("[INFO] Clearing custom path")
		Persistant.Config:SetAndSave("ffmpeg_path", "")
		exit(0)
	else
		print_info("[INFO] Validating path: "..Args.path)
		local success, message = FFcore.ValidateBinPath(Args.path)
		if success then
			print_info("[INFO] Successfully setup path")
			Persistant.Config:SetAndSave("ffmpeg_path", Args.path)
		else
			print_error("[ERROR] Failed to setup path: "..message)
		end
		exit(success and 0 or 1)
	end
end
