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
	return t
end

function table.extend(t1, t2)
	for _,v in ipairs(t2) do
		table.insert(t1, v)
	end
end

function table.contains(table, element)
    if table == nil then return false end

    for _, value in pairs(table) do
        if value == element then
          return true
        end
    end
    return false
end

function table.merge(...)
	local result = {}
	for i = 1, select("#", ...) do
		for k,v in pairs(select(i, ...))do
			result[k] = v
		end
	end
	return result
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

-- find item by binary search, return item index
-- t = {1, 2, 3, 5, 6, 7}
-- BinSearch(t, function(v) return v - 3 end) --> 3, nil
-- BinSearch(t, function(v) return v - 4 end) --> 3, 4
-- BinSearch(t, function(v) return v - 9 end) --> nil (not found)
function BinSearch(t, fn, i, j)
	i = i or 1 -- start index
	j = j and math.min(#t, j) or #t -- end index
	local left = fn(t[i])
	local right = fn(t[j])
	while true do
		if left == 0 then
			return i
		elseif right == 0 then
			return j
		end
		if i + 1 == j then
			if left < 0 and right > 0 then
				return i, j
			else
				return nil
			end
		end
		local k = math.floor((i+j)/2)
		local mid = fn(t[k])
		if mid == 0 then
			return k
		elseif mid < 0 then
			i = k
			left = mid
		else
			j = k
			right = mid
		end
		print(i, j, k)
	end
end

--- debug ---
local time = -1
function timeit(silent)
	if not silent then
		print(string.format("TIME USE: %d ms", now() - time))
	end
	time = now()
end