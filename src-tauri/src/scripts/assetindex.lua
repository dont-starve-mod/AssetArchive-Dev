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

	-- animzip: *.zip -> anim.bin + build.bin
	local total = #animzip
	local step = math.floor(total / 10)
	for i, v in ipairs(animzip) do
		if v:is_file() and v:check_extention(".zip") then
			local mtime = v:mtime()
			local filename = v:name()
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

		if i % step == 0 then
			self:OnProgress(i / total / 2) -- 0% -> 50%
		end
	end

	-- animdyn: anim_dynamic.zip -> *.zip -> build.bin
	if animdyn ~= nil then
		local total = GetTableSize(animdyn.contents)
		local step = math.floor(total / 10)
		local i = 0
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
			if i % step == 0 then
				self:OnProgress(i / total / 2 + 0.5) -- 50% -> 100%
			end 
		end
	end

	self.indexcache:Save()
	Persistant.Hash:Update(HashLib.map_string):Save()
	print(HashLib:Size())

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

function AssetIndex:OnProgress(percent)
	print(table.concat({
		string.rep("-", math.floor(percent*32) + 0.5),
		" (",
		tostring(math.floor(math.min(100, math.floor(percent*100 + 0.5)))),
		"%) ",
		string.rep("-", math.floor((1-percent)*32 + 0.5)),
	}, ""))
	SetState("index_progress", percent)
end

local i = AssetIndex(Root)
print(json.encode(i:GetAnimFileList("wilson", "idle_loop")))
print(json.encode(i:GetBuildFile("merm_king_carpet")))

-- self.animinfo = {} # [hash]-> ['idle_loop']: {filelist, facinglist}
-- 		self.buildinfo = {} # 'wilson'-> {file, swap_icon}

-- 		self.animcache = AnimIndexCache()
-- 		self.buildcache = BuildIndexCache()
-- 		self.hashcache = HashCache()

-- 		hashcollection.map.update(self.hashcache.get("data") or {})

-- 		self.build_index_for_anim(root)
-- 		self.build_index_for_build(root)

-- 		self.hashcache.set("data", hashcollection.map)
-- 		self.hashcache.save()
--[==[
	def build_index_for_anim(self, root):
		print()
		t = time.time()
		print_info("建立动画索引...")
		zippathlist = [i for i in (root/"anim").iterdir() if i.suffix == ".zip"]
		total = len(zippathlist)
		for i, zippath in enumerate(zippathlist):
			# 优先查找缓存
			if (info:= self.animcache.get(zippath.name)) != None:
				if info.get("mtime") and info.get("info"):
					mtime = zippath.stat().st_mtime
					if info["mtime"] > mtime - 1:
						self.add_animinfo(info["info"], zippath, True)
						continue

			al = ZipLoader.loadanim(zippath, alias = zippath.stem, lazy = True)
			if not al or al.error: continue

			info = []
			for anim in al.animdata["anim"]:
				info.append((anim["name"], anim["bankhash"], anim["facing"]))
			self.add_animinfo(info, zippath)

			if i % 100 == 0:
				self.onprogress("anim", i / total)
		
		self.onprogress("anim", 1.01)
		print_info("完成 (%.2fs)" % (time.time()-t))

		self.animcache.save()

	def add_animinfo(self, info: list, zippath, skipcache = False):
		if not skipcache:
			self.animcache.set(zippath.name, {"mtime": zippath.stat().st_mtime, "info": info})

		for animname, bankhash, facing in info:
			if bankhash not in self.animinfo:
				self.animinfo[bankhash] = {}
			if animname not in self.animinfo[bankhash]:
				self.animinfo[bankhash][animname] = {"filelist": set(), "facinglist": set()}

			info = self.animinfo[bankhash][animname]
			# 记录动画所在的资源包和朝向
			# 有少部分动画, 会把同一动画的不同朝向装在两个zip包中, 比如spider_queen.zip/spider_queen_2.zip
			# 对于这些动画, 需要记录所有的资源包
			info["filelist"].add(zippath.name)
			info["facinglist"].add(facing)

	def build_index_for_build(self, root):
		print()
		t = time.time()
		print_info("建立材质索引...")
		zippathlist = [i for i in (root/"anim").iterdir() if i.suffix == ".zip"]
		part1 = len(zippathlist)
		if (f:=root.databundles.get("anim/dynamic")):
			dyninfolist = f.infolist()
			part2 = len(dyninfolist)
		else:
			dyninfolist = []
			part2 = 0
		# anim/dynamic/researchlab2_gothic.zip -> researchlab2_gothic.zip
		self.dynbuildnames = set(i.filename[13:] for i in dyninfolist)
		total = part1 + part2

		for i, zippath in enumerate(zippathlist):
			# 优先查找缓存
			if (info:= self.buildcache.get(zippath.name)) != None:
				if info.get("mtime") and info.get("info") != None:
					mtime = zippath.stat().st_mtime
					if info["mtime"] > mtime - 1:
						self.add_buildinfo(info["info"], zippath, True)
						continue

			bl = ZipLoader.loadbuild(zippath, alias = zippath.stem, lazy = True)
			if not bl or bl.error: continue

			info = {}
			info["build"] = bl.builddata["name"]
			# 注意: 有几个材质名是大小写混用的 (如Pig_King), 但压缩包名是纯小写 (如pig_king.zip)
			if zippath.stem != bl.builddata["name"].lower():
				info["file"] = zippath.name
			if bl.swap_icon_data:
				info["swap_icon"] = bl.swap_icon_data

			self.add_buildinfo(info, zippath)

			if i % 100 == 0:
				self.onprogress("build", i / total)

		# 压缩包信息中的修改日期形式为 year, month, day, hour, minute, second
		# 为了区分文件被修改, 使用变化范围较大的      *            *       *
		calc_mtime = lambda date_time: \
		    date_time[2]*10000+date_time[4]*100+date_time[5]

		for i, dyninfo in enumerate(dyninfolist):
			name = dyninfo.filename
			mtime = calc_mtime(dyninfo.date_time)
			if (info:= self.buildcache.get(name)) != None:
				if info.get("mtime") and info.get("info") != None:
					if info["mtime"] == mtime:
						self.add_buildinfo(info["info"], (name, mtime), True)
						continue

			bl = ZipLoader.loadbuild(f.open(name), alias = name, lazy = True)
			if not bl or bl.error: continue

			info = {}
			info["build"] = bl.builddata["name"]
			if os.path.splitext(os.path.basename(name))[0] != bl.builddata["name"].lower():
				info["file"] = os.path.basename(name)
			if bl.swap_icon_data:
				info["swap_icon"] = bl.swap_icon_data

			self.add_buildinfo(info, (name, mtime))

			if i % 100 == 0:
				self.onprogress("build", (i + part1) / total)

		self.onprogress("build", 1.01)
		print_info("完成 (%.2fs)" % (time.time()-t))

		self.buildcache.save()

	def add_buildinfo(self, info: dict, zippath, skipcache = False):
		if not skipcache:
			if isinstance(zippath, Path):
				self.buildcache.set(zippath.name, {"mtime": zippath.stat().st_mtime, "info": info})
			else:
				self.buildcache.set(zippath[0], {"mtime": zippath[1], "info": info})

		self.buildinfo[info["build"]] = info		

	def onprogress(self, type: str, percent: float):
		''' 广播进度信息, 用于在页面展示进度条 '''
		print("-"* int(percent* 40) + " (" + str(int(min(100, percent*100))) + "%) " + "-"* int((1-percent)*40),
			end = "\r" if percent < 1 else "\n")

		ws_pushmessage(key = "indexprogress", value = {"type": type, "percent": percent})

	# 对外接口
	def api_getanimfilelist(self, bankhash, animation):
		''' 根据bank和anim获取zip路径, 注意该方法返回文件列表'''
		if isinstance(bankhash, str):
			bankhash = smallhash(bankhash)
		info = self.animinfo.get(bankhash, {}).get(animation)
		if info and info.get("filelist"):
			return ["anim/" + path for path in info["filelist"]]

	def api_getbuildswapicon(self, buildname):
		''' 获取build的皮肤图标信息 '''
		if (info:= self.buildinfo.get(buildname)) and info.get("swap_icon"):
			return info["swap_icon"]

	def api_getbuildfile(self, buildname):
		''' 根据build获取zip路径 '''
		if (info:= self.buildinfo.get(buildname)) and info.get("file"):
			return "anim/" + info["file"]

		zipname = buildname.lower()
		if not zipname.endswith(".zip"):
			zipname += ".zip"
		if zipname in self.dynbuildnames:
			return "anim/dynamic/" + zipname
		else:
			return "anim/" + zipname
]==]