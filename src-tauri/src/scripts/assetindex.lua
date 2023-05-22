-- generate index for quickly access to anim/build source file

local CreateReader = FileSystem.CreateReader
local CreateBytesReader = FileSystem.CreateBytesReader

local AssetIndex = Class(function(self, root)
	self.root = root
	self.animinfo = {}  -- [hash] = {idle_loop = {files, facings}}
	self.buildinfo = {} -- swap_pitchfork = {file, icon}
	self.indexcache = Persistant.IndexCache

	self:DoIndex()
end)

function AssetIndex:DoIndex(ignore_cache)
	local t = now()
	print("Index assets ...")
	local animzip = (self.root/"anim"):iter()
	local animdyn = self.root.databundles["anim/dynamic/"]
	local animzip_total = #animzip
	local animdyn_total = GetTableSize(animdyn and animdyn.contents)
	local total = animzip_total + animdyn_total
	local bar = ProgressBar(total)
	local function OnProgress(i)
		bar:set_position(i)
		SetState("index_progress", i / total)
		if i == total then
			bar:done()
		end
	end

	-- animzip: *.zip -> anim.bin + build.bin
	for i, v in ipairs(animzip) do
		if v:is_file() and v:check_extention(".zip") then
			local mtime = v:mtime()
			local filename = "anim/"..v:name()
			local cacheinfo = self.indexcache:Get(filename)
			if not ignore_cache and mtime ~= nil and cacheinfo ~= nil and cacheinfo.mtime == mtime then
				-- use cache
				self:AddAnim(filename, cacheinfo.anim)
				self:AddBuild(filename, cacheinfo.build)
			else
				local zip = ZipLoader(CreateReader(v), ZipLoader.NAME_FILTER.INDEX)
				local anim_raw = zip:Get("anim.bin")
				local build_raw = zip:Get("build.bin")
				local info = {
					mtime = mtime,
					anim = {},
					build = {},
				}
				if anim_raw ~= nil then
					local al = AnimLoader(CreateBytesReader(anim_raw), true)
					if not al.error then
						for _, anim in ipairs(al.animlist) do
							table.insert(info.anim, {
								name = anim.name,
								bankhash = anim.bankhash,
								facing = anim.facing,
							})
						end
					end
				end
				if build_raw ~= nil then
					local bl = BuildLoader(CreateBytesReader(build_raw), true)
					if not bl.error then
						table.insert(info.build, {
							name = bl.buildname,
							swap_icon_0 = bl.swap_icon_0
						})
					end
				end

				self.indexcache:Set(filename, info)
				self:AddAnim(filename, info.anim)
				self:AddBuild(filename, info.build)
				zip:Close()
			end
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
								swap_icon_0 = bl.swap_icon_0
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

	local t = now() - t
	if t > 200 then
		print(("USE TIME: %d ms"):format(t))
	end
end

function AssetIndex:AddBuild(name, info)
	for _, build in ipairs(info)do
		self.buildinfo[build.name] = {
			file = name,
			icon = build.swap_icon_0
		}
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
	end
end

function AssetIndex:GetBuildFile(buildname)
	return self.buildinfo[buildname] and self.buildinfo[buildname].file
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

return AssetIndex