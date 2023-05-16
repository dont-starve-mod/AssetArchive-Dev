IpcHandlers = {}

IpcHandlers.Register = function(name, handler)
	local function fn(param)
		if param == "" then
			param = nil
		else
			local success = false
			success, param = pcall(json.decode, param)
			if not success then
				print("Error in parsing lua ipc handler `"..name.."` param: "..param)
				return json.encode({error = "json.decode", msg = param})
			end
		end

		local result = handler(param)
		if type(result) == "string" then
			return result
		elseif type(result) == "table" then
			local success, result = pcall(json.encode, result)
			if not success then
				print("Error in encoding lua ipc handler `"..name.."` return value: "..result)
				return json.encode({error = "json.encode", msg = result})
			else
				return result
			end
		else
			return tostring(result)
		end
	end

	IpcHandlers[name] = fn
end

-- Lua state
local state = {}
function SetState(k, v)
	if type(v) == "function" then
		state[k] = v(state[k])
	else
		state[k] = v
	end
end

function GetState(k)
	return state[k]
end

IpcHandlers.Register("getstate", function(key)
	return GetState(k)
end)

IpcHandlers.Register("sum", function(values)
	local total = 0
	for _,v in ipairs(values)do
		total = total + v
	end
	return total
end)

IpcHandlers.Register("bytes", function(_)
	return "\1\1\45\14"
end)
