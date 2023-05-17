-- Lua FileSystem: {
--   CreateReader(path: string) -> ReadStream | nil
--     open a file by path and return a ReadStream userdata
--     note: this function may fail on file not exists, permission denied, or reach max file descriptors
--     note: invoke f:drop() to close the file descriptor
--
--   CreateBytesReader(bytes: string) -> ReadStream
--     wrap a lua string to a ReadStream, so that make easy for binary unpack
--
--   *__index = {}
--     metatable register
-- }
-- 
-- [userdata] ReadStream
--   read_u16() -> number, 2 bytes, int
--   read_u32() -> number, 4 bytes, int
--   read_f32() -> number, 4 bytes, float
--
--   read(len) -> string | nil
--     read a string from file with almost length
--     note: the returned string may not have enough length as `len1`
--     return nil if reach EOF
--
--   read_exact(len) -> string | nil 
--     read a string from file with specified length,
--     return nil if bytes length is less than `len`,
--     else, the return value must guarantee that #value == len
--
--   seek_forward(len) -> number | nil
--     skip bytes of `len`, return current file position,
--     return nil if failed
--
--   setmode(MODE) -> nil, change data mode when parsing binary values
--   Example: 
--     local f = FileSystem.CreateReader("path/to/file")
--     if f ~= nil then
--       f:setmode(FileSystem.DATAMODE_LE) -- set mode to little-endian
--       f:setmode(FileSystem.DATAMODE_BE) -- set mode to big-endian
--       -- do something ...
--       f:close()
--     end

global("APP_CACHE_DIR")
global("APP_CONFIG_DIR")
global("APP_LOG_DIR")
global("APP_DATA_DIR")
global("HOME_DIR")

-- fallbacks
-- -- dev branch strict check
assert(APP_DATA_DIR, "APP_DATA_DIR is nil")
APP_DATA_DIR = APP_DATA_DIR or HOME_DIR
APP_CACHE_DIR = APP_CACHE_DIR or APP_DATA_DIR
APP_CONFIG_DIR = APP_CONFIG_DIR or APP_DATA_DIR
APP_LOG_DIR = APP_LOG_DIR or APP_DATA_DIR

local ReadStream = FileSystem.ReadStream__index
local ZipReader = FileSystem.ZipReader__index

function ReadStream.read_and_unpack(fs, str)
    local result = {}
    for c in str:gmatch(".") do
        if c == "I" then
            table.insert(result, fs:read_u32())
        elseif c == "f" then
            table.insert(result, fs:read_f32())
        elseif c == "H" then
            table.insert(result, fs:read_u16())
        else
            error("Invalid token: "..c)
        end

    end
    return unpack(result)
end

-- read a string with length `len`
-- if reach EOF, this method will return nil
-- else, the return value `s` must guarantee that #s == len
function ReadStream.read_string(fs, len)
    return fs:read_exact(len)
end

-- read all remaining content to a string
function ReadStream.read_to_end(fs)
    local content = {}
    while true do
        local s = fs:read(65536)
        if s ~= nil then
            table.insert(content, s)
        else
            break
        end
    end
    return table.concat(content, "")
end

-- read a variable length string with a u32 len, useful for reading anim/build file
function ReadStream.read_variable_length_string(fs)
    local len = fs:read_u32()
    if len ~= nil then
        return fs:read_exact(len)
    end
end

-- close a file, this method is alias of `drop`
function ReadStream.close(fs)
    fs:drop()
end

-- get current position within file
function ReadStream.tell(fs)
    return fs:seek_forward(0)
end

-- 