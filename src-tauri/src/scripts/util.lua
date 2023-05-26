function GetTableSize(table)
	local n = 0
	if table ~= nil then
		for k in pairs(table) do
		    n = n + 1
		end
	end
	return n
end

function ToIndexTable(table)
	local t = {}
	for _,v in ipairs(table)do
		t[v] = true
	end
end

function table.extend(t1, t2)
	for _,v in ipairs(t2) do
		table.insert(t1, v)
	end
end

function string.startswith(str, neddle)
    return str:sub(1, #neddle) == neddle
end

function string.endswith(str, neddle)
	return str:sub(#str - #neddle + 1, #str) == neddle
end

function string.isascii(str)
	for i = 1, #str do
		if string.byte(str, i) > 127 then
			return false
		end
	end
	return true
end

function string.count(str, neddle)
	local n =  0
	for _ in str:gmatch(neddle)do
		n = n + 1
	end
	return n
end

function math.clamp(n, min, max)
	return math.max(math.min(n, max), min)
end

--- debug ---
local time = -1
function timeit(silent)
	if not silent then
		print(string.format("TIME USE: %d ms", now() - time))
	end
	time = now()
end