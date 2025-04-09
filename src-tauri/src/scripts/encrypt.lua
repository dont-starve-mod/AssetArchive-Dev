local ERROR_EOF = { success = false, msg = "Unexpected EOF" }
local ERROR_SIG = { success = false, msg = "Unexpected file sig" }

local function EncryptZip(inpath, outpath, opts)
	-- encrypt a zipfile
	assert(type(opts) == "table")
	local rename_fn = opts.rename_fn

	local f = FileSystem.CreateReader(inpath)
	assert(f, "Failed to open input file: "..tostring(inpath))

	local i = 0
	local out = {}
	local name_map = {}
	while f:seek_to_string(ZIP_SIG) do
		local current = f:tell()
		f:seek_to(i)
		local bytes = f:read_exact(current - i
			+ 4
			+ 2 -- method
			+ 4 -- mtime
			+ 4 -- crc
		)
		local compressed_len = f:read_u32()
		local raw_len = f:read_u32()
		local name_len = f:read_u16()
		local extra_len = f:read_u16()
		if extra_len == nil then return ERROR_EOF end
		local name = f:read_string(name_len)
		if name == nil then return ERROR_EOF end

		local new_name = rename_fn(name)
		if new_name ~= nil then
			print("Change archive name: "..name)
			name_len = #new_name
		else
			new_name = name
		end
		name_map[name] = new_name
		-- pack

		table.insert(out, bytes)
		table.insert(out,
			PackInt(compressed_len, 4)..
			PackInt(raw_len, 4)..
			PackInt(name_len, 2)..
			PackInt(extra_len, 2)..
			new_name)
		local bytes = f:read_exact(compressed_len)
		if bytes == nil then return ERROR_EOF end
		table.insert(out, bytes)
		i = f:tell()
	end
	f:seek_to(i)
	table.insert(out, f:read_to_end())

	FileSystem.Path(outpath):write(table.concat(out))
end

local function EncryptBuild(opts)
	assert(type(opts) == "table")
	local f = nil
	if opts.source then
		f = FileSystem.CreateBytesReader(opts.source)
	elseif opts.inpath then
		f = FileSystem.CreateReader(opts.inpath)
	else
		error("Must specify source or inpath")
	end

	local key = opts.key -- add a key symbol into symbol list
	local lock_message = opts.lock_message -- add readable lock message into hashmap
	local new_build_name = opts.new_build_name -- rename build
	local encrypt_atlas_name = opts.encrypt_atlas_name -- change altas name to `{index}\1\1\4\5\1\4`

	local out = {}
	local new_bytes = {}
	if f:read_string(4) ~= BUILD_SIG then
		return ERROR_SIG
	end

	table.insert(out, BUILD_SIG)
	table.insert(out, f:read_exact(4))
	local numsymbols = f:read_u32()
	table.insert(out, f:read_exact(4))
	local name = f:read_variable_length_string()
	local numatlases = f:read_u32()
	if numatlases == nil then return ERROR_EOF end


	-- UNIMPL
end

do return end
p = "/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/data/anim/"
EncryptZip(p.."researchlab-0/归档.zip", p.."researchlab.zip",
	{rename_fn = function(name) 
		if name:endswith(".txt") then return "\1"..name end 
	end})


exit()