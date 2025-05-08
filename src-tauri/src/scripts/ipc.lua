IpcHandlers = {}

IpcHandlers.Register = function(name, handler)
	local function fn(param)
		if param == "" then
			param = nil
		else
			local success, param_or_msg = pcall(json.decode, param)
			if not success then
				local msg = "IpcError<"..name.."> in decoding param json:\n"..param
				return error(msg)
			else
				param = param_or_msg
			end
		end

		local msg = nil
		local function onerror(e)
			msg = "IpcError<"..name.."> in invoking handler:\n"..tostring(e).."\n"..
				debug.traceback()
		end
		local success, result = xpcall(handler, onerror, param)
		if not success then
			print(msg)
			return error(msg)
		end
		if type(result) == "string" then
			return result
		elseif type(result) == "table" then
			local success, result = pcall(json.encode_compliant, result)
			if not success then
				local msg = "IpcError<"..name.."> in encoding result:\n"..result
				return error(msg)
			else
				return result
			end
		elseif type(result) == "number" or type(result) == "boolean" or type(result) == "nil" then
			return json.encode_compliant(result)
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

IpcHandlers.Register("forcecrash", function()
	local function crash()
		error("Lua force crash")
	end

	return crash()
end)

IpcHandlers.Register("set", function(param)
	print("[SET]", param.key, param.value)
	Persistant.Config:SetAndSave(param.key, param.value)
	return Persistant.Config:Get(param.key)
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

SelectFileInFolder = function(path)
	-- open a file browser in the folder
end
