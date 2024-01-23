-- utils for ffmpeg encoder
local Config = Persistant.Config

local print_info = rawget(_G, "print_info") or print
local print_error = rawget(_G, "print_error") or print

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
    WINDOWS = "https://i-320.wwentua.com:446/01211900159317473bb/2024/01/21/5f82b419cb852d3f5f99f550b5e5d426.7z?st=Crye9Gkel6pyD0ftsOsz0w&e=1705840151&b=BzMAZgJvViNZaV9uB3oENglyXDAFKQppUnIBf1Q2AGwFIwBpVDVUPVVzAwoBM1UkBzsOPlM2Vn4GYl0q&fi=159317473&pid=111-205-233-231&up=2&mp=0&co=0",
    MACOS = "https://evermeet.cx/ffmpeg/get/zip",
    MACOS = "https://i-440.wwentua.com:446/01212000159319374bb/2024/01/21/a164970a19e324477a1244bc981efe84.zip?st=2XQbfBHhMAG19dOx4o09AQ&e=1705840550&b=UWUAZghlVyJQYFJjB3oGMwRgDmFUZgMxUjUMLAZmAmIGMV1pAmQEYlFiVTMHZVJhADcIelcsBmlWdQ_c_c&fi=159319374&pid=111-205-233-231&up=2&mp=0&co=0",
}

local DOWNLOADER_ID = "FFMPEG"

function FFmpeg:StartDownloading()
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
    return self.binpath:is_file() or (Config:Get("ffmpeg_path") or "") ~= ""
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
        print_info("[INFO] 开始安装 (compressed_method=zip)")
        local f = ZipLoader(FileSystem.CreateBytesReader(bytes), ZipLoader.NAME_FILTER.ALL_LAZY)
        for _, name in ipairs(f:List())do
            if name:find("ffmpeg") then
                local bytes = f:Get(name)
                if bytes and #bytes > BINSIZE then
                    binpath:write(bytes)
                    binpath:set_mode(511) -- 0o777
                    print_info("[INFO] 安装完成")
                    return binpath
                end
            end
        end
        error("[ERROR] 安装失败: 无法解压程序包")
    elseif bytes:startswith("\55\122\188\175\39") then
        print_info("[INFO] 开始安装 (compressed_method=7z)")
        local bytes = Algorithm.Sevenz_Decompress(bytes)
        if bytes and #bytes > BINSIZE then
            binpath:write(bytes)
            binpath:set_mode(511) -- 0o777
            print_info("[INFO] 安装完成")
            return binpath
        else
            print_error(type(bytes), bytes ~= nil and #bytes or -1)
            print_error("Internal error: decompressed bytes too short")
            error("[ERROR] 安装失败: 无法解压程序包")
        end
    else
        error("[ERROR] 安装失败: 无法识别文件格式")
    end
end

function FFmpeg:ValidateBinPath(path)
    return FFcore.ValidateBinPath(path)
end

function FFmpeg:TryGetBinPath()
    local path = Config:Get("ffmpeg_path")
    if path ~= nil and FFcore.ValidateBinPath(path) then
        return path
    elseif FFcore.ValidateBinPath(self.binpath:as_string()) then
        return self.binpath:as_string()
    else
        print_error("Warning: failed to get ffmpeg path")
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