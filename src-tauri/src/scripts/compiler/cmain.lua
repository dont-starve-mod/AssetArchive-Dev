-- main for entry/asset desc compiler

-- *.po file loader
local Po = Class(function(self, root, lang)
	local f = root:Open("scripts/languages/"..lang..".po")
	local function convert(s)
		return s:gsub("\\n", "\n"):gsub("\\r", "\r"):gsub("\\\"", "\""):gsub("\\\\", "\\")
	end

	assert(f, "Failed to open file: chinese_s.po")
	f:seek_to_string("#") -- skip file head
	local content = f:read_to_end()
	local strings = {}
	local key, value
	local index = 0
	while true do
		local eol = content:find("\n", index)
		if eol ~= nil then
			local line = content:sub(index, eol - 1)
			index = eol + 1

			key = line:match("^msgctxt%s*%\"(%S*)%\"") or key
			value = line:match("^msgstr%s*%\"(.*)%\"") or value
			if value and key then
				strings[key] = convert(value)
				key = nil
				value = nil
			end
		else
			break
		end
	end

	self.strings = strings
end)

function Po:__call(key)
	return self.strings[key]
end

function Po:GetName(name)
	if name == "wagstaff" then
		-- TODO: move to external file
		return "瓦格斯塔夫"
	elseif name == "hermit" then
		return self:GetName("HERMITCRAB")
	end

	return self("STRINGS.NAMES."..name:upper())
end

function Po:GetQuote(name)
	return self("STRINGS.CHARACTER_QUOTES."..name:lower())
end

function Po:GetSkinName(name)
	return self("STRINGS.SKIN_NAMES."..name:lower())
end

function Po:GetSkinQuote(name)
	return self("STRINGS.SKIN_QUOTES."..name:lower())
end

local function main(GLOBAL)
	print_info("[Compiler] main()")

	local success, prefabdata = pcall(json.decode, FileSystem.GetString("prefab.dat"))
	assert(success, "Failed to load prefab.dat")

	GLOBAL.prefabdata = prefabdata
	GLOBAL.po = Po(GLOBAL.root, "chinese_s")

	local output = FileSystem.Path(SCRIPT_ROOT)/"compiler"/"output"
	GLOBAL.write_json = function(module_name, data)
		local str = json.encode_compliant(data)
		local path = (output/(module_name..".lua"))
		path:write("return "..json.encode(str))
	end

	-- run asset annotator
	local run = require "compiler.assetdesc.dmain"
	run(GLOBAL)
	-- run entry annotator
	local run = require "compiler.entrydesc.emain"
	run(GLOBAL)
	-- run animation preset
	local run = require "compiler.animpreset.pmain"
	run(GLOBAL)

	-- finally, write static file
	local path = output/"assetdesc.lua"
	path:write(
		"return "..
		json.encode(FileSystem.GetString("assetdesc.dat"))
	)
	local path = output/"entry.lua"
	path:write(
		"return "..
		json.encode(FileSystem.GetString("entry.dat"))
	)

	print("compile done")
end

return {
	main = main
}
