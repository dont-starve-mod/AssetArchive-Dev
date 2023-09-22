local RichText = require "richtext"
local r = RichText

local function CreateLoader(root)
	local script_bundle_path = root/"databundles"/"scripts.zip"
	local zip = ZipLoader(FileSystem.CreateReader(script_bundle_path), ZipLoader.NAME_FILTER.ALL_LAZY)

	return function(path, env)
		env = env or {}
		env.pairs = pairs
		env.ipairs = ipairs
		local module_path = "scripts/"..path:gsub("[.]", "/")..".lua"
		if zip:Exists(module_path) then
			local c = zip:Get(module_path)
			local f = loadstring(c, module_path)
			setfenv(f, env)
			f()
			return env
		else
			error("file not exists: "..module_path)
		end
	end
end

local AssetAnnotator = {
	env = {},
	data = {},
	po = nil,
	assets = nil,
	load = nil,

	PreLoad = function(self)
		self.MISC_ITEMS = self.load("misc_items").MISC_ITEMS
		self.PREFAB_SKINS = self.load("prefabskins").PREFAB_SKINS

		self.skin_to_prefab = {}
		for prefab,v in pairs(self.PREFAB_SKINS)do
			for _, skin in ipairs(v)do
				assert(self.skin_to_prefab[skin] == nil, prefab.."->"..skin)
				self.skin_to_prefab[skin] = prefab
				-- TODO 可能需要处理一下皮肤共用关系？
			end
		end
		self.IsSkin = function(self, skin)
			return self.skin_to_prefab[skin] ~= nil 
		end

		-- tex finder
		self.texelement_map = {}
		for _,v in ipairs(self.assets.alltexelement)do
			if self.texelement_map[v.xml] == nil then
				self.texelement_map[v.xml] = {}
			end
			table.insert(self.texelement_map[v.xml], v)
		end
		self.FindTexList = function(self, xml)
			return self.texelement_map[xml]
		end
	end,

	AddDesc = function(self, asset, desc)
		if self.data[asset] == nil then
			self.data[asset] = {}
		end
		table.insert(self.data[asset], desc)
	end,

	Minimap = function(self)
		local minimap_desc = require "compiler.assetdesc.minimap_desc"
		local util = minimap_desc(self.env)

		for _,v in ipairs(self.assets.alltexelement)do
			if v.xml == "minimap/minimap_data.xml" then
				local name = NameOf(v.tex)
				local prefablist = {name}
				if util.ref[name] ~= nil then
					table.extend(prefablist, util.ref[name])
				end
				local label = nil
				for _,v in ipairs(prefablist)do
					label = self.po:GetName(v)
					if label ~= nil then
						break
					end
				end
				if label ~= nil then
					self:AddDesc(v, label.."的小地图图标")
				else
					print("----------", v.tex)
						-- TODO 这里有一大堆东西需要手动标注
				end
			end
		end
	end,

	Wallpaper = function(self)
		local names = {}
		for k,v in pairs(self.MISC_ITEMS)do
			if v.type == "loading" then
				names[k] = true
			end
		end

		for _,v in ipairs(self.assets.alltexelement)do
			local xml, tex = v.xml, v.tex
			local name = tex:sub(1, #tex - 4)
			if names[name] then
				names[name] = nil
				local label = self.po:GetSkinName(name)
				if label ~= nil then
					self:AddDesc(v, label.. "（加载图片）")
				else
					print("Warning: skinname not found: "..name)
				end
			end
		end

		for k in pairs(names)do
			print("Warning: wallpaper `"..name.."` in MISC_ITEMS, but not in assets")
		end
	end,

	Character = function(self)
		local function GetName(prefab)
			return prefab == "random" and
				assert(self.po("STRINGS.UI.LOBBYSCREEN.RANDOMCHAR_BUTTONHINT")) or
				assert(self.po:GetName(prefab), prefab)
		end

		local function GetSkinName(prefab)
			return prefab == "random_none" and
				assert(self.po("STRINGS.UI.LOBBYSCREEN.RANDOMCHAR_BUTTONHINT")) or
				assert(self.po:GetSkinName(prefab), prefab)
		end

		for _,v in ipairs(self.assets.alltexelement)do
			local xml, tex = v.xml, v.tex
			if xml:startswith("images/names_") then
				local name = xml:sub(14, #xml - 4)
				if name:startswith("gold_cn_") then
					name = name:sub(9)
					self:AddDesc(v, GetName(name).."的名字（中文）")
				elseif name:startswith("gold_") then
					name = name:sub(6)
					self:AddDesc(v, GetName(name).."的名字（金色）")
				else
					name = name
					self:AddDesc(v, GetName(name).."的名字")
				end
			elseif xml:startswith("bigportraits/") then
				local name = xml:sub(14, #xml - 4)
				if self:IsSkin(name) or name == "random_none" then
					self:AddDesc(v, GetSkinName(name).."的立绘")
				elseif name == "locked" then
					self:AddDesc(v, "未解锁角色的立绘。\n该图片仅在单机版使用。")
				elseif name == "unknownmod" then
					self:AddDesc(v, "未知角色的默认立绘。\n当mod角色未加载立绘资源时，将使用该图片作补充。")
				else
					self:AddDesc(v, GetName(name).."的立绘（已弃用）")
				end
			end
		end

		for _,v in ipairs(self.assets.alldynfile)do
			if v.file:startswith("anim/dynamic/") then
				local name = NameOf(v.file:sub(14))
				if self:IsSkin(name) then
					self:AddDesc(v, GetSkinName(name))
				end
			end
		end
	end,

	ImagePostLink = function(self)
		for _,v in ipairs(self.assets.allxmlfile)do
			if self.data[v] == nil and v._numtex == 1 then
				-- link this tex desc to xml
				local tex = self:FindTexList(v.file)
				assert(#tex == 1)
				tex = tex[1]
				if self.data[tex] then
					-- print("Auto link: "..v.file, tex)
					self:AddDesc(v, self.data[tex][1].."（图集）")
				end
			end
		end
	end,

	InventoryImage = function(self)
		for _,v in ipairs(self.assets.allxmlfile)do
			if v.file == "images/inventoryimages.xml" then
				assert(self.data[v] == nil, "Deprecated asset annotation is unique: "..v.file)
				self:AddDesc(v, "物品栏图片（已弃用）")
			elseif v.file:startswith("images/inventoryimages") then
				self:AddDesc(v, "物品栏图片（合集"..v.file:sub(23, 23).."）")
			end
		end
		for _,v in ipairs(self.assets.alltexelement)do
			if v.xml == "images/inventoryimages.xml" then
				assert(self.data[v] == nil, "Deprecated asset annotation is unique: "..v.tex)
				self:AddDesc(v, "物品栏图片（已弃用）")
			elseif v.xml:startswith("images/inventoryimages") then
				local name = NameOf(v.tex)
				local label = self.po:GetName(name)
				local skin_label = self.po:GetSkinName(name)
				if label then
					self:AddDesc(v, label.."的物品栏图片")
				elseif skin_label then
					local prefab = self.skin_to_prefab[name]
					local prefab_label = prefab and self.po:GetName(prefab)
					if prefab_label then
						self:AddDesc(v, skin_label.."的物品栏图片（"..prefab_label.."的皮肤）")
					else
						self:AddDesc(v, skin_label.."的物品栏图片（皮肤）")
						error("Warning: Failed to get skin prefab: "..name.." - "..skin_label)
					end
				else
					-- print(v.tex) -- TODO:这里也需要手动标注
					-- break
				end
			end
		end
	end,

	Deprecated = function(self)
		
	end,
}

local function run(env)
	local root = assert(env.root)
	local provider = assert(env.prov)
	local po = assert(env.po)

	print_info("[AssetAnnotator] run")
	local annotator = setmetatable({
		env = env,
		data = {},
		po = po,
		assets = assert(provider.assets, "Asset list not found, call `ListAsset` first"),
		load = CreateLoader(root)
	}, {__index = AssetAnnotator})

	annotator:PreLoad()	
	annotator:Minimap()
	annotator:Wallpaper()
	annotator:Character()
	annotator:InventoryImage()
	annotator:ImagePostLink()
	annotator:Deprecated()

	for _,v in pairs(annotator.data)do
		-- print(v[1])
	end

	local data = {}
	for k,v in pairs(annotator.data)do
		local id = k:GetID()
		data[id] = v -- TODO: richtext
	end

	FileSystem.SaveString("assetdesc.dat", json.encode_compliant(data))

	return annotator.data
end

return run