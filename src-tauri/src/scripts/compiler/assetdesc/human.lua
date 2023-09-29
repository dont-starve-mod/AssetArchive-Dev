local r = require "richtext"

local HumanAnnotator = Class(function(self, env)
	self.env = env
	self.po = env.po
	self.assets = env.assets
	self.data = env.data

	self.assets_map = {}
	for _,v in pairs(self.assets)do
		for _,asset in ipairs(v)do
			self.assets_map[asset.id] = asset
		end
	end
end)

function HumanAnnotator:AddDesc(asset, desc, opts)
	local opts = opts or {}
	local id = asset:GetID()
	local asset = self.assets_map[id] or {}
	if opts.check_exists ~= false and self.data[asset] == nil then
		table.foreach(asset, print)
		error("Asset not exists: "..tostring(asset))
	end
	local list = self.data[asset] or {}
	if #list > 0 and list[1] == self.env.DUMMY_DESC then
		table.remove(list, 1)
	end
	if #list > 0 then
		if opts.append then
			table.insert(list, desc)
		else
			print("Warning: desc is overrided: "..tostring(asset))
			table.foreach(list, print)
			list = {desc}
		end
	else
		list = {desc}
	end
	self.data[asset] = list
end

function HumanAnnotator:Minimap()
	local t = {
		{"archive_orchestrina_main", "远古档案馆解谜"},
		{"oceanfish_shoalspawner", "鱼群刷新点"},
		{"messagebottletreasure_marker", "瓶中信宝藏标记点"},
		{"cave_hole", "洞穴陷坑"},
		{"flotsam_heavy", "沉海物"},
		{"pillar_archive", "远古档案馆柱子"},
	}
	for i = 0, 7 do
		table.insert(t, {"moonstormmarker"..i, "月亮风暴"})
	end

	table.foreach(t, function(_, v)
		local name, desc = unpack(v)
		desc = desc .. "的小地图图标"
		self:AddDesc(Asset("tex", {xml = "minimap/minimap_data.xml", tex = name..".png"}), desc)
	end)
end

function HumanAnnotator:ColourCube(list)
	local t = {
		{"identity_colourcube", "恒等滤镜（Identity）", "不改变任何颜色的滤镜，图片在经过此滤镜处理后保持原样。\n虽然没有任何效果，但也算一种游戏资源，主要用作空滤镜的占位。"},
		{"insane_day_cc",   "疯狂的滤镜（白天）", "在白天理智值过低时触发的滤镜"},
		{"insane_dusk_cc",  "疯狂的滤镜（黄昏）", "在黄昏理智值过低时触发的滤镜"},
		{"insane_night_cc", "疯狂的滤镜（夜晚）", "在夜晚理智值过低时触发的滤镜"},
		{"lunacy_regular_cc", "启蒙的滤镜", "在月岛探索，启蒙值过高时触发的滤镜"},
		{"moonstorm_cc", "月亮风暴的滤镜", "进入月亮风暴时触发的滤镜"},
		{"day05_cc",   "秋季滤镜（白天）"},
		{"dusk03_cc",  "秋季滤镜（黄昏）"},
		{"night03_cc", "秋季滤镜（夜晚）"},
		{"snow_cc",     "冬季滤镜（白天）"},
		{"snowdusk_cc", "冬季滤镜（黄昏）"},
		{"night04_cc",  "冬季滤镜（夜晚）"},
		{"spring_day_cc", "春季滤镜（白天）"},
		{"spring_dusk_cc", "春季滤镜（黄昏、夜晚）", "春季的黄昏和夜晚共用同一个滤镜"},
		{"spring_night_cc", "春季滤镜（未使用）", r"该资源未被游戏使用，详见"..r.asset_link("spring_dusk_cc")},
		{"summer_day_cc", "夏季滤镜（白天）"},
		{"summer_dusk_cc", "夏季滤镜（黄昏）"}, 
		{"summer_night_cc", "夏季滤镜（夜晚）"},
		{"caves_default", "洞穴滤镜"},
		{"purple_moon_cc", "月圆之夜的滤镜"},
		{"ghost_cc", "鬼魂滤镜", "玩家死亡后触发的滤镜"},

		{"beaver_vision_cc", "河狸滤镜", "在伍迪变身后触发的夜视效果滤镜"},

		{"mole_vision_off_cc", "鼹鼠帽滤镜（过曝）", "在白天和月圆之夜使用鼹鼠帽触发的滤镜，白茫茫一片几乎啥也看不清"},
		{"mole_vision_on_cc", "鼹鼠帽滤镜（正常）", "在黄昏、夜晚和洞穴内使用鼹鼠帽触发的夜视效果滤镜"},

		{"ruins_dark_cc", "洞穴遗迹滤镜（暗）", "在洞穴远古区域探索时，平静期的滤镜效果。"},
		{"ruins_dim_cc", "洞穴遗迹滤镜（过渡）", "在洞穴远古区域探索时，警告期和黎明期的滤镜效果。"},
		{"ruins_light_cc", "洞穴遗迹滤镜（亮）", "在洞穴远古区域探索时，暴动期的滤镜效果。"},

		{"fungus_cc", "真菌滤镜", "该资源似乎和洞穴有关，但并未被游戏使用"},
		{"sinkhole_cc", "坑洞滤镜", "该资源似乎和洞穴有关，但并未被游戏使用"},

		{"lavaarena2_cc", "熔岩竞技场滤镜", "在特殊活动“熔炉”中使用的滤镜"},
		{"quagmire_cc",   "泥潭滤镜", "在特殊活动“暴食”中使用的滤镜"},
	}

	for i = #list, 1, -1 do
		local v = list[i]
		local name = NameOf(v.file)
		for j, data in ipairs(t)do
			if data[1] == name then
				table.remove(t, j)
				table.remove(list, i)
				table.foreach(data, function(k, desc)
					if k > 1 then
						self:AddDesc(v, desc, {check_exists = false, append = true})
					end
				end)
				break
			end
		end
	end

	assert(#list == 0, json.encode(list))
	assert(#t == 0)
end

return HumanAnnotator