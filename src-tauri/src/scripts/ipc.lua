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

		local msg = nil
		local function onerror(e)
			msg = "Error in ipc `"..name.."`: "..e.."\n"..
				debug.traceback()
		end
		local success, result = xpcall(handler, onerror, param)
		if not success then
			print(msg)
			return json.encode({error = "ipc", msg = msg})
		end
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
	return GetState(key)
end)

-- ipc util functions:
-- these function must be invoked by ipc handler api
-- registered before every ipc call, and destructed after the call

IpcEmitEvent = function(event, payload)
	-- push event to frontend
end

IpcSetState = function(k, v)
	-- set a key -> value pair to core state
end

IpcInterrupted = function()
	-- check if core has a interrupt flag
	-- useful for aborting an expensive job in middle
end
