-- add description to assets

local RichText = require "richtext"
local r = RichText
local Human = require "compiler.assetdesc.human"

DUMMY_DESC = { _dummy = true }

local zip = nil

local function GetSource(path)
	local module_path = "scripts/"..path:gsub("[.]", "/")..".lua"
	if zip:Exists(module_path) then
		return zip:Get(module_path)
	else
		error("file not exists: "..module_path)
	end
end

local function CreateLoader(root)
	local script_bundle_path = root/"databundles"/"scripts.zip"
	zip = ZipLoader(FileSystem.CreateReader(script_bundle_path), ZipLoader.NAME_FILTER.ALL_LAZY)

	return function(path, env)
		env = env or {}
		env.pairs = pairs
		env.ipairs = ipairs
		local src = GetSource(path)
		local f = loadstring(src, path)
		setfenv(f, env)
		f()
		return env
	end
end

local AssetAnnotator = {
	env = {},
	data = {},
	debug_id_map = {},
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
		function self:IsSkin(skin)
			return self.skin_to_prefab[skin] ~= nil 
		end

		-- xml finder & tex finder
		self.xml_map = {}
		self.texelement_map = {}
		for _,v in ipairs(self.assets.allxmlfile)do
			self.xml_map[v.file] = v
			self.texelement_map[v.file] = {}
		end
		for _,v in ipairs(self.assets.alltexelement)do
			table.insert(self.texelement_map[v.xml], v)
		end

		function self:FindXml(xml)
			return assert(self.xml_map[xml])
		end

		function self:FindTexList(xml)
			return assert(self.texelement_map[xml])
		end

		self.human = Human(self)
	end,

	AddDesc = function(self, asset, desc)
		local id = asset:GetID()
		if self.data[id] == nil then
			self.data[id] = {}
		end
		table.insert(self.data[id], desc)

		self.debug_id_map[id] = asset
	end,

	Minimap = function(self)
		local minimap_ref = require "compiler.assetdesc.minimap_ref"
		local ref = minimap_ref(self.env).ref -- map_icon -> prefab_name[]
		local dummy_minimaps = {}
		local moonstorm_ids = {}
		for _,v in ipairs(self:FindTexList("minimap/minimap_data.xml"))do
			-- if v.xml == "minimap/minimap_data.xml" then
				local name = NameOf(v.tex)
				if name:startswith("moonstormmarker") then
					moonstorm_ids[name:sub(16, #name)] = true
				end

				local prefablist = {name}
				if ref[name] ~= nil then
					table.extend(prefablist, ref[name])
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
					self:AddDesc(v, DUMMY_DESC)
					dummy_minimaps[v.tex] = true
				end
			-- end
		end

		self.human.temp_moonstorm_ids = moonstorm_ids
		self.human:Minimap(dummy_minimaps)
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
					self:AddDesc(v, label.. "（"..self.po("STRINGS.SKIN_TAG_CATEGORIES.TYPE.LOADING").."）")
				else
					print("Warning: wallpaper skinname not found: "..name)
				end
			end
		end

		for k in pairs(names)do
			print("Warning: wallpaper `"..name.."` in MISC_ITEMS, but not in assets")
		end
	end,

	Character = function(self)
		local function GetName(prefab)
			assert(prefab)
			return prefab == "random" and
				assert(self.po("STRINGS.UI.LOBBYSCREEN.RANDOMCHAR_BUTTONHINT")) or
				assert(self.po:GetName(prefab), prefab)
		end

		local function GetSkinName(prefab)
			assert(prefab)
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
					local cname = nil
					if not self.skin_to_prefab[name] then
						if name ~= "random_none" then
							error("Failed to get prefab from skinname: "..name)
						end
					end
					local cname = self.skin_to_prefab[name] and GetName(self.skin_to_prefab[name])
					if cname then
						self:AddDesc(v, GetSkinName(name).."的立绘（"..cname.."）")
					else
						self:AddDesc(v, GetSkinName(name).."的立绘")
					end
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
				local name2, extra = self.human:GetInventoryImageRedirect(name)
				name = name2 or name
				extra = extra or ""
				if type(name) == "function" then
					self:AddDesc(v, name(self.po))
				else
					local label = self.po:GetName(name)
					local skin_label = self.po:GetSkinName(name)
					if label then
						self:AddDesc(v, label.."的物品栏图片"..extra)
					elseif skin_label then
						local prefab = self.skin_to_prefab[name]
						local prefab_label = prefab and self.po:GetName(prefab)
						if prefab_label then
							self:AddDesc(v, skin_label.."的物品栏图片（"..prefab_label.."的皮肤）"..extra)
						else
							error("Warning: Failed to get skin prefab: "..name.." - "..skin_label)
							self:AddDesc(v, skin_label.."的物品栏图片（皮肤）")
						end
					else
						print(v.tex) -- TODO:这里也需要手动标注
						-- break
					end
				end
			end
		end
	end,

	Customization = function(self)
		local image_to_option = {}
		for _,v in ipairs(self.env.prefabdata.customize)do
			image_to_option[v.image] = v
		end

		local custom_xmls = {}
		local desc_str = "自定义配置"
		self:AddDesc(self:FindXml("images/worldgen_customization.xml"),
			desc_str.." "..self.po("STRINGS.UI.CUSTOMIZATIONSCREEN.TAB_TITLE_WORLDGENERATION"))
		self:AddDesc(self:FindXml("images/worldsettings_customization.xml"),
			desc_str.." "..self.po("STRINGS.UI.CUSTOMIZATIONSCREEN.TAB_TITLE_WORLDSETTINGS"))
		self:AddDesc(self:FindXml("images/customisation.xml"),
			desc_str)
		for _,xml_name in ipairs{"worldgen_customization", "worldsettings_customization", "customisation"}do
			for _,v in ipairs(self:FindTexList("images/"..xml_name..".xml"))do
				local o = image_to_option[v.tex]
				local desc = nil
				if o ~= nil then
					desc = string.format("%s的%s图标", 
						self.po("STRINGS.UI.CUSTOMIZATIONSCREEN."..o.name:upper()), desc_str)
				else
					local s = self.po("STRINGS.UI.CUSTOMIZATIONSCREEN."..v.tex:sub(1, #v.tex - 4):upper())
					desc = s and string.format("%s的%s图标", s, desc_str)
				end
				if desc ~= nil then
					self:AddDesc(v, desc)
				else
					print("Unknown custom icon", v.tex)
				end
			end
		end
	end,

	ScrapbookIcon = function(self)
		local xmls = {}
		local texs = {}
		for i = 1, math.huge do
			local path = "images/scrapbook_icons"..i..".xml"
			if self.xml_map[path] then
				self:AddDesc(self.xml_map[path], "图鉴")
				xmls[path] = true
				for _,tex in ipairs(self:FindTexList(path))do
					texs[tex.tex] = tex -- string -> <Asset type="tex">
				end
			else
				break
			end
		end

		local data = loadstring(self.src("screens/redux/scrapbookdata"))()
		for k,v in pairs(data)do
			local name = assert(v.name)
			local tex = assert(v.tex)
			local prefab = assert(v.prefab)
			local desc = self.po:GetName(name)
			local type = assert(v.type)
			local is_inv = type == "item" or type == "food"
			-- `item` and `food` use inventory item atlas
			-- (see screens/redux/scrapbookscreen.lua 867)
				
			if desc ~= nil then
				if texs[tex] then
					self:AddDesc(texs[tex], desc.."的图鉴")
				elseif is_inv then
					-- do nothing
				else
					error("scrapbook tex invalid: "..tex)
				end
			else
				error("scrapbook desc not found: "..name)
			end

			texs[tex] = nil
		end

		-- TODO: icons should add desc by human
		for k,v in pairs(texs)do
			if k:startswith("icon_") then
				texs[k] = nil
			end
		end
		self:AddDesc(texs["unknown.tex"], "未知图鉴")
		texs["unknown.tex"] = nil

		if next(texs) ~= nil then
			print("Warning: scrapbook desc annotator: ")
			table.foreach(texs, print)
		end
	end,



	Music = function(self)
		local nightmare = self.src_hash("components/nightmareclock", 0x7b24b46f)
		local ambient   = self.src_hash("components/ambientsound", 0xa57a07a2)
		local music     = self.src_hash("components/dynamicmusic", 0x314bb6cf)
		local function CollectFmodPath(s)
			-- NOTE: only match double quotation marks
			--	    "path/to/sound" √
			--	    'path/to/sound' ✕
			local result = {}
			for path in s:gmatch("\"([^\"]*)\"")do
				local total = 0
				for _,v in ipairs{string.byte(path, 1, 100)}do
					if v == 47 then -- "/"
						total = total + 1
					end
				end
				if total >= 2 then -- fmod sound path contains at least 2
					result[path] = true
					-- print(path)
				end
			end
			return result
		end
		
		nightmare = CollectFmodPath(nightmare)
		ambient   = CollectFmodPath(ambient)
		music     = CollectFmodPath(music)

		self.human:Music({
			nightmare = nightmare,
			ambient = ambient,
			music = music,
		})
	end,

	CharacterVoice = function(self)
		local names = self.human:GetCharacterVoiceName()
		for _,v in ipairs(self.assets.allfevfile)do
			for k, event in pairs(v.event_map)do
				if k:startswith("characters") and event.has_sounddef then
					local asset = Asset("fmodevent", {path = v.project_name.."/"..k --[[ full path ]]})
					self:AddDesc(asset, "#character_voice", {check_exists = false})
					local desc = names.others(k)
					if desc then
						self.human:AddDesc(asset, desc, {check_exists = false, append = true})
					else
						local _, _, prefab, type = k:find("/([^/]+)/(.+)$")
						if prefab ~= nil then
							if prefab ~= "skincollector" and prefab ~= "lava_arena" 
								and prefab ~= "wilton" and prefab ~= "winnie" 
								and prefab ~= "wallace" and prefab ~= "wyro"
								and prefab ~= "corvus" and prefab ~= "crowkid"
								then
								-- TODO: fix anno for non players

								local cname = assert(self.po:GetName(prefab), "Failed to get name: "..prefab)
								local action = names[type]
								if not action then
									print(">>>>>", type)
									self.human:AddDesc(asset, cname.."的语音", {check_exists = false, append = true})
								else
									self.human:AddDesc(asset, cname.."的语音 - "..action, {check_exists = false, append = true})
								end							
							end
						else
							print("Failed to parse character voice: "..k)
						end
					end
				end
				--
			end
		end
	end,

	CC = function(self)
		local temp = {}
		for _,v in ipairs(self.assets.alltexture)do
			if v._is_cc then
				table.insert(temp, v)
			end
		end
		self.human:ColourCube(temp)
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
		load = CreateLoader(root),
		src = GetSource,
		-- add hash checker which emits warning when game script file changed
		src_hash = function(path, hash)
			local s = GetSource(path)
			local h = Algorithm.SmallHash_Impl(s)
			if h ~= hash then
				print("Warning: hash of file `"..path.."` changed to `"..
					string.format("0x%x", h).."`")
			end
			return s
		end,
		DUMMY_DESC = DUMMY_DESC,
	}, {__index = AssetAnnotator})

	annotator:PreLoad()	
	annotator:Minimap()
	annotator:Wallpaper()
	annotator:Character()
	annotator:Customization()
	annotator:InventoryImage()
	annotator:ScrapbookIcon()
	annotator:ImagePostLink()
	annotator:Music()
	annotator:CharacterVoice()
	annotator:CC()
	annotator:Deprecated()

	for _,v in pairs(annotator.data)do
		-- print(v[1])
	end

	local data = {}
	for id,v in pairs(annotator.data)do
		data[id] = v
		local plain_desc = {}

		table.sort(v, function(a, b)
			-- move tags to bottom 
			local a_is_tag = type(a) == "string" and a:startswith("#")
			local b_is_tag = type(b) == "string" and b:startswith("#")
			if a_is_tag ~= b_is_tag then
				return b_is_tag
			else
				return false
			end
		end)

		for i, desc in ipairs(v)do
			if desc == DUMMY_DESC then
				print("Warning: dummy desc in: "..tostring(id))
				print(json.encode(annotator.debug_id_map[id]))
			end
			if type(desc) == "string" then
				table.insert(plain_desc, desc)
			else
				local value, text = desc:FlattenWithPlain()
				desc = {
					type = "rich",
					value = value
				}
				table.insert(plain_desc, text)
				-- TODO: 在这里可以直接解析assetlink label
			end
			v[i] = desc
		end

		data[id].plain_desc = table.concat(plain_desc, " ")
	end

	FileSystem.SaveString("assetdesc.dat", json.encode_compliant(data))

	return annotator.data
end

return run