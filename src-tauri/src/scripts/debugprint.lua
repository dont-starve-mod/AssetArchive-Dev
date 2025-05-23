PRINT_SOURCE = true
PRINT_TIME = Args ~= nil

local print_loggers = {print_info}

local start = now()

function AddPrintLogger( fn )
    table.insert(print_loggers, fn)
end

local oldprint = print

matches =
{
	["^"] = "%^",
	["$"] = "%$",
	["("] = "%(",
	[")"] = "%)",
	["%"] = "%%",
	["."] = "%.",
	["["] = "%[",
	["]"] = "%]",
	["*"] = "%*",
	["+"] = "%+",
	["-"] = "%-",
	["?"] = "%?",
	["\0"] = "%z",
}
function escape_lua_pattern(s)
	return (s:gsub(".", matches))
end


local function packstring(...)
    local str = ""
    local n = select('#', ...)
    for i=1,n do
        str = str..tostring(select(i, ...)).."\t"
    end
    return str
end
--this wraps print in code that shows what line number it is coming from, and pushes it out to all of the print loggers
print = function(...)
    local str = ""
    if PRINT_SOURCE then
        local info = debug.getinfo(2, "Sl")
        local source = info and info.source
        if source then
            -- hack
            if source:startswith("@"..SCRIPT_ROOT) then
                source = source:sub(#SCRIPT_ROOT+2)
            end
            str = string.format("%s:%d: %s", source, info.currentline, packstring(...))
        else
            str = packstring(...)
        end
    else
        str = packstring(...)
    end

    if PRINT_TIME then
        str = string.format("[%.3f] ", (now() - start) / 1000) .. str
    end

    for i,v in ipairs(print_loggers) do
        v(str)
    end
end

-- show the line number of function that calls *print
funcprint = function(...)
    local str = ""
    local info = debug.getinfo(3, "Sl")
    local source = info and info.source
    if source then
        -- hack
        if source:startswith("@"..SCRIPT_ROOT) then
            source = source:sub(#SCRIPT_ROOT+2)
        end
        str = string.format("%s:%d: %s", source, info.currentline, packstring(...))
    else
        str = packstring(...)
    end

    for i,v in ipairs(print_loggers) do
        v(str)
    end
end

--This is for times when you want to print without showing your line number (such as in the interactive console)
nolineprint = function(...)
    for i,v in ipairs(print_loggers) do
        v(...)
    end

end

do return end

---- This keeps a record of the last n print lines, so that we can feed it into the debug console when it is visible
local debugstr = {}
local MAX_CONSOLE_LINES = 20

local consolelog = function(...)

    local str = packstring(...)
    str = string.gsub(str, dir, "")

    for idx,line in ipairs(string.split(str, "\r\n")) do
        table.insert(debugstr, line)
    end

    while #debugstr > MAX_CONSOLE_LINES do
        table.remove(debugstr,1)
    end
end

function GetConsoleOutputList()
    return debugstr
end

-- add our print loggers
if IsNotConsole() then
	AddPrintLogger(consolelog)
end

