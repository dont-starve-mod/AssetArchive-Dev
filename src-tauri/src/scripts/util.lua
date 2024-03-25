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

local insert = table.insert

function ToArray(table)
	local t = {}
	for k in pairs(table)do
		insert(t, k)
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

function table.reverse(tab)
    local size = #tab
    local result = {}

    for i,v in ipairs(tab) do
        result[size-i+1] = v
    end

    return result
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

function table.getkeys(t)
	local result = {}
	for k in pairs(t)do
		table.insert(result, k)
	end
	return result
end

function string.startswith(str, neddle)
    return str:sub(1, #neddle) == neddle
end

function string.endswith(str, neddle)
	return str:sub(#str - #neddle + 1, #str) == neddle
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
-- BinSearch(t, function(v) return v - 0 end) --> nil (not found)
function BinSearch(t, fn, i, j)
	-- print("Start BinSearch")
	-- print("  t: ", json.encode(t))
	-- print("  i, j: ", i, j)

	i = i or 1 -- start index
	j = j and math.min(#t, j) or #t -- end index
	local left = fn(t[i])
	local right = fn(t[j])
	for _ = 1, 100000 do
		if left == 0 then
			return i
		elseif right == 0 then
			return j
		end
		if i + 1 == j or i == j then
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
	end
	error("Inf loop in binsearch")
end

function BitAnd(a, b)
	local p, c = 1, 0 
	while a > 0 and b > 0 do 
		local ra, rb = a%2, b%2 
		if ra + rb > 1 then 
			c = c + p 
		end 
		a,b,p = (a-ra)/2,(b-rb)/2,p*2 
	end 
	return c 
end

function NameOf(path)
	local name = select(3, path:find("([^/.]+)%.?[a-z]*$"))
	if name ~= nil then
		return name
	else
		error("Failed to get name of "..path)
	end
end

function Counter()
	return setmetatable({_ = {}}, {
		__index = {
			Add = function(self, key, value)
				if self._[key] == nil then
					self._[key] = 0
				end
				self._[key] = self._[key] + (value or 1)
			end,
			Get = function(self, key, default)
				return self._[key] or default
			end,
			GetAll = function(self)
				return self._
			end,
			GetMost = function(self)
				local key, value = nil, 0
				for k, v in pairs(self._)do
					if v > value then
						value = v
						key = k
					end
				end
				return key, value
			end,
		}
	})
end

--- debug ---
local time = -1
function timeit(silent)
	if not silent then
		print(string.format("TIME USE: %d ms", now() - time))
	end
	time = now()
end

DUMMY_FIELD = {}
setmetatable(DUMMY_FIELD, {__index = function() return DUMMY_FIELD end})