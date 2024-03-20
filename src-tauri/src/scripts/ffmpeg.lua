-- utils for ffmpeg encoder
local Config = Persistant.Config

local FFmpeg = Class(function(self)
    self.bindir = APP_DATA_DIR/"bin"
    self.binname = PLATFORM == "WINDOWS" and "ffmpeg.exe" or "ffmpeg"
    self.binpath = self.bindir/self.binname

    if not self.bindir:exists() then
        self.bindir:create_dir()
    end
end)

local URLS = {
    WINDOWS = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z",
    WINDOWS = "https://fs-im-kefu.7moor-fs1.com/29397395/4d2c3f00-7d4c-11e5-af15-41bf63ae4ea0/1706414482389/ffmpeg-6.0-essentials_build.7z",
    MACOS = "https://evermeet.cx/ffmpeg/get/zip",
    MACOS   = "https://fs-im-kefu.7moor-fs1.com/29397395/4d2c3f00-7d4c-11e5-af15-41bf63ae4ea0/1706414482230/ffmpeg-113344-gbe4fcf027b.zip",
}

local DOWNLOADER_ID = "FFMPEG"
FFmpeg.DOWNLOADER_ID = DOWNLOADER_ID

function FFmpeg:StartDownloading()
    print_info("[INFO] Start downloading FFmpeg")
    local url = URLS[PLATFORM]
    if url == nil then
        error("[ERROR] Unsupported platform: "..PLATFORM)
    end
    local s = Downloader.GetState(DOWNLOADER_ID)
    if s == nil or s.status ~= "WORKING" then
        Downloader.Cancel(DOWNLOADER_ID)
        Downloader.Start(DOWNLOADER_ID, url, true)
    end
end

function FFmpeg:Uninstall()
    if self.binpath:exists() then
        self.binpath:delete()
    end
    if not self.binpath:exists() then
        print_info("[INFO] FFmpeg has been successfully removed")
        return true
    else
        print_error("[ERROR] Failed to remove FFmpeg")
        return false
    end
end

function FFmpeg:GetState()
    local installed = self.binpath:is_file()
        and self:ValidateBinPath(self.binpath)
    local custom_path = Config:Get("ffmpeg_path")
    local custom_installed = custom_path ~= nil and custom_path ~= ""
        and self:ValidateBinPath(custom_path)

    return {
        installed = installed,
        custom_installed = custom_installed,
        custom_path = custom_path,
    }
end

function FFmpeg:IsAvailable()
    return self:TryGetBinPath("no_warning") ~= nil
end

function FFmpeg:Install(bytes)
    local binpath = self.binpath
    if binpath:exists() then
        return
    end
    local BINSIZE = 10*1000*1000

    if bytes:startswith("\0\0\0\32\102\116\121\112\105\115") then
        bytes = bytes:sub(2189, #bytes)
    end

    if bytes:startswith(ZIP_SIG) then
        print_info("[INFO] unpack file (compressed_method=zip)")
        local f = ZipLoader(FileSystem.CreateBytesReader(bytes), ZipLoader.NAME_FILTER.ALL_LAZY)
        for _, name in ipairs(f:List())do
            if name:find("ffmpeg") then
                local bytes = f:Get(name)
                if bytes and #bytes > BINSIZE then
                    binpath:write(bytes)
                    binpath:set_mode(511) -- 0o777
                    print_info("[INFO] successfully installed FFmpeg")
                    return binpath
                end
            end
        end
        error("[ERROR] Failed to install")
    elseif bytes:startswith("\55\122\188\175\39") then
        print_info("[INFO] unpack file (compressed_method=7z)")
        local bytes = Algorithm.Sevenz_Decompress(bytes)
        if bytes and #bytes > BINSIZE then
            binpath:write(bytes)
            binpath:set_mode(511) -- 0o777
            print_info("[INFO] successfully installed FFmpeg")
            return binpath
        else
            print_error(type(bytes), bytes ~= nil and #bytes or -1)
            print_error("Internal error: decompressed bytes too short")
            error("[ERROR] Failed to install")
        end
    else
        error("[ERROR] Failed to install: unknown file type")
    end
end

function FFmpeg:ValidateBinPath(path)
    return FFcore.ValidateBinPath(path)
end

function FFmpeg:TryGetBinPath(no_warning)
    local path = Config:Get("ffmpeg_path")
    if path ~= nil and FFcore.ValidateBinPath(path) then
        return path, "CUSTOM"
    elseif FFcore.ValidateBinPath(self.binpath:as_string()) then
        return self.binpath:as_string(), "AUTO"
    elseif not no_warning then
        error("Failed to get ffmpeg path")
    end
end

FFmpegManager = FFmpeg()

IpcHandlers.Register("ffmpeg_install", function(param)
    if param.type == "start" then
        FFmpegManager:StartDownloading()
        return true
    elseif param.type == "update" then
        local s = Downloader.GetState(DOWNLOADER_ID)
        if s.status == "FINISH" then
            local path = FFmpegManager:Install(Downloader.GetData(DOWNLOADER_ID))
            if path then
                FFmpegManager:ValidateBinPath(path)
            end
            Downloader.ClearData(DOWNLOADER_ID)
            return {
                success = true,
            }
        else        
            return json.encode_compliant{
                current_downloaded = s.current_downloaded,
                status = s.status,
            }
        end
    end
end)

IpcHandlers.Register("ffmpeg_getstate", function()
    return FFmpegManager:GetState()
end)

IpcHandlers.Register("ffmpeg_uninstall", function(param)
    FFmpegManager:Uninstall()
end)

IpcHandlers.Register("ffmpeg_custom_install", function(param)
    assert(type(param) == "table")
    assert(type(param.path) == "string")
    if param.path == "" then
        Config:SetAndSave("ffmpeg_path", "")
    else
        local success, message = FFcore.ValidateBinPath(param.path)
        if success then
            Config:SetAndSave("ffmpeg_path", param.path)
            return {
                success = true,
            }
        else
            return {
                success = false,
                message = message,
            }
        end
    end
end)