-- generate index for quickly access to anim/build source file

local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader
local LoadAnimZip = Indexer.LoadAnimZip

local AssetIndex = Class(function(self, root)
	self.root = root
	self.animinfo = {}  -- [hash] = {idle_loop = {files, facings}}
	self.buildinfo = {} -- swap_pitchfork = {file, icon, numatlases}
	self.zipinfo = {} -- anim/log.zip = {has_build, has_anim}
	self.indexcache = Persistant.IndexCache 
end)

function AssetIndex:DoIndex(ignore_cache)
	local t = now()
	print("Index assets ...")
	-- start flag
	IpcEmitEvent("index_progress", tostring(0))

	local animzip = (self.root/"anim"):iter_file_with_extension(".zip")
	local animdyn = self.root.databundles["anim/dynamic/"]
	local animzip_total = #animzip
	local animdyn_total = GetTableSize(animdyn and animdyn.contents)
	local total = animzip_total + animdyn_total
	local bar = ProgressBar(total)
	local function OnProgress(i)
		if IpcInterrupted() then
			return error(ERROR.IPC_INTERRUPTED)
		end
		bar:set_position(i)
		if i < total then
			IpcEmitEvent("index_progress", tostring(i/total))
		else
			IpcEmitEvent("index_progress", "1")
			bar:done()
		end
	end

	-- animzip: *.zip -> anim.bin + build.bin
	for i, v in ipairs(animzip) do
		local mtime = v:mtime()
		local filename = "anim/"..v:name()
		local cacheinfo = self.indexcache:Get(filename)
		if not ignore_cache and mtime ~= nil and cacheinfo ~= nil and cacheinfo.mtime == mtime then
			-- use cache
			self:AddAnim(filename, cacheinfo.anim)
			self:AddBuild(filename, cacheinfo.build)
		else
			local info = {}
			local data = LoadAnimZip(v)
			info.mtime = mtime
			info.anim = data.anim or {}
			info.build = data.build or {}

			-- local zip = ZipLoader(CreateReader(v), ZipLoader.NAME_FILTER.INDEX)
			-- local anim_raw = zip:Get("anim.bin")

			-- if anim_raw ~= nil then
			-- 	local al = AnimLoader(CreateBytesReader(anim_raw))
			-- 	if not al.error then
			-- 		for _, anim in ipairs(al.animlist) do
			-- 			table.insert(info.anim, {
			-- 				name = anim.name,
			-- 				bankhash = anim.bankhash,
			-- 				facing = anim.facing,
			-- 			})
			-- 		end
			-- 	end
			-- end
			-- local build_raw = zip:Get("build.bin")

			-- if build_raw ~= nil then
			-- 	local bl = BuildLoader(CreateBytesReader(build_raw), true)
			-- 	if not bl.error then
			-- 		table.insert(info.build, {
			-- 			name = bl.buildname,
			-- 			numatlases = bl.numatlases,
			-- 			swap_icon_0 = bl.swap_icon_0,
			-- 		})
			-- 	end
			-- end

			self.indexcache:Set(filename, info)
			self:AddAnim(filename, info.anim)
			self:AddBuild(filename, info.build)
		end

		if i % 100 == 0 then
			OnProgress(i)
		end
	end

	-- animdyn: anim_dynamic.zip -> *.zip -> build.bin
	if animdyn ~= nil then
		local i = animzip_total
		for k in pairs(animdyn.contents)do
			if k:endswith(".zip") then
				local filename = k
				local cacheinfo = self.indexcache:Get(filename)
				local mtime = animdyn:GetModified(k)
				if not ignore_cache and mtime ~= nil and cacheinfo ~= nil and cacheinfo.mtime == mtime then
					-- use cache
					self:AddBuild(filename, cacheinfo.build)
				else
					local zip = ZipLoader(CreateBytesReader(animdyn:Get(k)), ZipLoader.NAME_FILTER.BUILD)
					local build_raw, build_mtime = zip:Get("build.bin")
					local info = {mtime = mtime, build = {}}
					if build_raw ~= nil then
						local bl = BuildLoader(CreateBytesReader(build_raw), true)
						if not bl.error then
							table.insert(info.build, {
								name = bl.buildname,
								numatlases = bl.numatlases,
								swap_icon_0 = bl.swap_icon_0,
							})
							self.indexcache:Set(filename, info)
							self:AddBuild(filename, info.build)
						end
					end
				end
			end

			i = i + 1
			if i % 100 == 0 then
				OnProgress(i)
			end 
		end
	end

	OnProgress(total)

	self.indexcache:Save()
	Persistant.Hash:Update(HashLib.map_string):Save()

	IpcEmitEvent("anim_predictable_data", json.encode(
		self:Ipc_GetPredictableData()))

	local t = now() - t
	print(("Index ready: %d ms"):format(t))
end

function AssetIndex:AddBuild(name, info)
	for _, build in ipairs(info)do
		self.buildinfo[build.name] = {
			file = name,
			swap_icon_0 = build.swap_icon_0,
			numatlases = build.numatlases
		}
		-- this file contains build.bin
		if self.zipinfo[name] == nil then
			self.zipinfo[name] = {}
		end
		self.zipinfo[name].has_build = true
		self.zipinfo[name].build = build.name
	end
end

function AssetIndex:AddAnim(name, info)
	for _, anim in ipairs(info)do
		self.animinfo[anim.bankhash] = self.animinfo[anim.bankhash] or {}
		self.animinfo[anim.bankhash][anim.name] = self.animinfo[anim.bankhash][anim.name] or {
			facings = {},
			files = {},
		}
		local data = self.animinfo[anim.bankhash][anim.name]
		data.facings[anim.facing] = true
		data.files[name] = true
		-- this file contains anim.bin
		if self.zipinfo[name] == nil then
			self.zipinfo[name] = {}
		end
		self.zipinfo[name].has_anim = true

	end
end

function AssetIndex:GetBuildFile(buildname)
	if self.buildinfo[buildname] then
		return self.buildinfo[buildname].file
	elseif buildname:endswith(".dyn") and self.root:Exists(buildname:sub(1, #buildname - 4)..".zip") then
		return buildname:sub(1, #buildname - 4)..".zip"
	elseif self.root:Exists(buildname) then
		return buildname
	end
end	

function AssetIndex:GetAnimFileList(bankhash, animname)
	if type(bankhash) == "string" then
		bankhash = Algorithm.SmallHash_Impl(bankhash)
	end
	local data = self.animinfo[bankhash] and self.animinfo[bankhash][animname]
	if data ~= nil then
		return data.files
	end
end

function AssetIndex:GetZipFileAbstract(name)
	return self.zipinfo[name]
end

function AssetIndex:ListBuildNames()
	local result = {}
	for k in pairs(self.buildinfo)do
		if k:is_ascii() then
			table.insert(result, k)
		else
			print_info("non-ascii build name is ignored: "..k)
		end
	end
	return result
end

function AssetIndex:ListAnimations()
	local result = {}
	for k,v in pairs(self.animinfo)do
		local bank = {bank = k, animation = {}}
		table.insert(result, bank)
		for name, data in pairs(v) do
			if name:is_ascii() then
				table.insert(bank.animation, {name = name, facings = table.getkeys(data.facings)})
			else
				print_info("non-ascii animation name is ignored: "..name)
			end
		end
	end
	return result
end

-- return a list of build name, bank name, bank hash & animation name, helpful for renderer
function AssetIndex:Ipc_GetPredictableData()
	return {
		build = self:ListBuildNames(), -- build[]
		animation = self:ListAnimations(), -- {bank, animation: {name, facings: byte[] }[] }[]
		hashmap = HashLib:Serialize(), -- [string, hash][]
	}
end

return AssetIndex