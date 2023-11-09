-- utils for ffmpeg encoder

local FFmpeg = Class(function(self)
    self.bindir = APP_DATA_DIR/"bin"
    self.binname = PLATFORM == "WINDOWS" and "ffmpeg.exe" or "ffmpeg"
    self.binpath = self.bindir/self.binname

    if not self.bindir:exists() then
        self.bindir:create_dir()
    end
end)

function FFmpeg:Uninstall()
    if self.binpath:exists() then
        self.binpath:delete()
    end
end

function FFmpeg:Install(bytes)
    if self.binpath:exists() then
        return
    end

    local print_info = print_info or print
    local print_error = print_error or print
    local BINSIZE = 10*1000*1000

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
                    return true
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
            return true
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
