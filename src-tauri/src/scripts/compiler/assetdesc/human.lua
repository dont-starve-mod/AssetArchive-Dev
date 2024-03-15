local r = require "richtext"

local HumanAnnotator = Class(function(self, env)
	self.env = env
	self.po = env.po
	self.assets = env.assets
	self.data = env.data
end)

function HumanAnnotator:AddDesc(asset, desc, opts)
	local opts = opts or {}
	local id = asset:GetID()
	if opts.check_exists ~= false and self.data[id] == nil then
		table.foreach(asset, print)
		error("Asset not exists: "..tostring(asset))
	end
	local list = self.data[id] or {}
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
	self.data[id] = list
end

function HumanAnnotator:Minimap(dummy_minimaps)
	dummy_minimaps = dummy_minimaps or {} -- easy checking minimap icon without desc

	local data = {
		{"oceanfish_shoalspawner", "鱼群刷新点"},
		{"messagebottletreasure_marker", "瓶中信宝藏标记"},
		{"cave_hole", "洞穴陷坑"},
		{"flotsam_heavy", "沉海物"},
		{"pillar_archive", "远古档案馆柱子"},
		{"icefishing_hole", "冰钓洞"},
	}
	for i in pairs(self.temp_moonstorm_ids) do -- assign in other script
		table.insert(data, {"moonstormmarker"..i, "月亮风暴标记"})
	end

	table.foreach(data, function(_, v)
		local name, desc = unpack(v)
		desc = desc .. "的小地图图标"
		local asset = Asset("tex", {xml = "minimap/minimap_data.xml", tex = name..".png"})
		self:AddDesc(asset, desc)
		
		dummy_minimaps[asset.tex] = nil
	end)

	-- special desc
	local moonstormmarker_desc = "总共有"..GetTableSize(self.temp_moonstorm_ids)
		.."个月亮风暴标记的小地图图标，图片本身是静态的，通过轮播实现动画效果。"
	for i in pairs(self.temp_moonstorm_ids)do
		local asset = Asset("tex", {xml = "minimap/minimap_data.xml", tex = "moonstormmarker"..i..".png"} )
		self:AddDesc(asset, moonstormmarker_desc, {append = true})
	end

	for k in pairs(dummy_minimaps)do
		print("Warning: minimap without desc: "..k)
	end
end

function HumanAnnotator:ColourCube(list)
	local t = {
		{"identity_colourcube", "恒等滤镜", "不改变任何颜色的滤镜，图片在经过此滤镜处理后保持原样。\n虽然没有任何效果，但也算一种游戏资源，主要用作空滤镜的占位。"},
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
		{"spring_night_cc", "春季滤镜（未使用）", r"该资源未被使用，夜晚的滤镜见"..r.asset_link("spring_dusk_cc"), TAGS.UNUSED},
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

function HumanAnnotator:Music(data)
	local po = self.po
	local music = data.music
	local path_collction = {}
	for source,paths in pairs(data)do
		-- source -> {[path]: true}
		for path in pairs(paths)do
			path_collction[path] = { source = source }
		end
	end

	local nightmare_str = "梦魇循环-"
	local data = {
		-- components/nightmareclock
		["dontstarve/cave/nightmare_warning"] = nightmare_str.."警告",
		["dontstarve/cave/nightmare_end"] = nightmare_str.."黎明",
		["dontstarve/cave/nightmare_full"] = nightmare_str.."狂野",
		["dontstarve/cave/nightmare"] = nightmare_str.."氛围声",

		-- components/dynamicmusic
		["dontstarve/music/music_work"] = "秋季工作音乐",
		["dontstarve/music/music_work_winter"] = "冬季工作音乐",
		["dontstarve_DLC001/music/music_work_spring"] = "春季工作音乐",
		["dontstarve_DLC001/music/music_work_summer"] = "夏季工作音乐",
		["dontstarve/music/music_work_cave"] = "洞穴工作音乐",
		["dontstarve/music/music_work_ruins"] = "远古遗迹工作音乐",

		["hookline_2/characters/hermit/music_work"] = "隐士小岛工作音乐",

		["dontstarve/music/music_epicfight"] = "秋季boss战音乐",
		["dontstarve/music/music_epicfight_winter"] = "冬季boss战音乐",
		["dontstarve_DLC001/music/music_epicfight_spring"] = "春季boss战音乐",
		["dontstarve_DLC001/music/music_epicfight_summer"] = "夏季boss战音乐",
		
		["dontstarve/music/music_danger"] = "秋季战斗音乐",
		["dontstarve/music/music_danger_winter"] = "冬季战斗音乐",
		["dontstarve_DLC001/music/music_danger_spring"] = "春季战斗音乐",
		["dontstarve_DLC001/music/music_danger_summer"] = "夏季战斗音乐",
		["dontstarve/music/music_danger_cave"] = "洞穴战斗音乐",
		["dontstarve/music/music_danger_ruins"] = "远古遗迹战斗音乐",

		["dontstarve/music/music_dusk_stinger"] = "黄昏已至。\n从白天切换到黄昏时播放的提示音乐——夜幕即将降临，做好准备。",
		["dontstarve/music/music_dawn_stinger"] = "黎明。\n从夜晚切换到白天时播放的提示音乐——你又幸存了一天。",
		["dontstarve/sanity/gonecrazy_stinger"] = "陷入疯狂。\n理智值过低时播放的提示音乐。",


		["moonstorm/characters/wagstaff/music_wagstaff_experiment"] = "瓦格斯塔夫的实验",

		["dontstarve/music/music_epicfight_gestalt_mutants"] = "变异boss战音乐（包括"
			..table.concat({po:GetName("MUTATEDDEERCLOPS"), po:GetName("MUTATEDBEARGER"), po:GetName("MUTATEDWARG"),
			}, "、").."）",
		["moonstorm/creatures/boss/alterguardian1/music_epicfight"] = po:GetName("alterguardian_phase1")
			.."boss战音乐（一阶段）",
		["moonstorm/creatures/boss/alterguardian2/music_epicfight"] = po:GetName("alterguardian_phase1")
			.."boss战音乐（二阶段）",
		["moonstorm/creatures/boss/alterguardian3/music_epicfight"] = po:GetName("alterguardian_phase1")
			.."boss战音乐（三阶段）",
		["saltydog/music/malbatross"] = po:GetName("malbatross").."boss战音乐",

		["wintersfeast2019/music/feast"] = "冬季盛宴",
		["yotc_2020/music/race"] = "胡萝卜鼠的比赛",
		["yotc_2020/music/training"] = "胡萝卜鼠的训练",
		["yotr_2023/common/music_pillowfight"] = "枕头大战",
		["dontstarve/music/music_pigking_minigame"] = "猪王的小游戏",

		["stageplay_set/bgm_moods/music_happy"] = "舞台剧-快乐",
		["stageplay_set/bgm_moods/music_mysterious"] = "舞台剧-神秘",
		["stageplay_set/bgm_moods/music_drama"] = "舞台剧-戏剧",

		["monkeyisland/warning_music/warning_combo"] = "海盗袭击",
		["turnoftides/music/working"] = "改潮换代-工作",
		["turnoftides/music/sailing"] = "改潮换代-航海",
		["farming/music/farming"] = "务农",

		["dontstarve/music/music_wigfrid_valkyrie"] = "尊贵坐骑。\n当薇格弗德激活骑牛相关技能后播放的音乐。",

		["summerevent/music/1"] = "狂欢节氛围",
		["summerevent/music/2"] = "狂欢节小游戏",
	}

	local boss_desc = {
		stalker = assert(po:GetName("stalker")),
		stalker_b = assert(po:GetName("stalker")),
		antlion = assert(po:GetName("antlion")),
		["3"] = assert(po:GetName("dragonfly")),
		["4"] = assert(po:GetName("beequeen")),
		["5a"] = assert(po:GetName("klaus")),
		["5b"] = assert(po:GetName("klaus")),
		eot = assert(po:GetName("eyeofterror")),
		daywalker = assert(po:GetName("daywalker")),
		toadboss = assert(po:GetName("toadstool")),
		crabking = assert(po:GetName("crabking")),
		sharkboy = assert(po:GetName("sharkboi")),
		moonbase = assert(po:GetName("moonbase")),
		moonbase_b = assert(po:GetName("moonbase")),

		ruins = "远古遗迹",
		cave = "洞穴",
	}
	for path in pairs(music)do
		if data[path] == nil and path:find("/music_epicfight_") then
			local boss_name = path:sub(select(2, path:find("/music_epicfight_"))+1, #path)
			if boss_desc[boss_name] ~= nil then
				data[path] = boss_desc[boss_name].."boss战音乐"
			else
				print("Boss music: "..path)
			end
		end
	end

	for path, desc in pairs(data)do
		path_collction[path] = nil
		local asset = Asset("fmodevent", {path = path})
		-- no need to check, it's ok that sound path not exists
		self:AddDesc(asset, desc, {check_exists = false})
		-- tags
		if path:find("dontstarve/cave/nightmare") then
			self:AddDesc(asset, "#ambient_sound", {check_exists = false, append = true})
		else
			self:AddDesc(asset, "#music", {check_exists = false, append = true})
		end

	end

	for path, v in pairs(path_collction)do
		print("SOUND", path)
	end
end

function HumanAnnotator:GetCharacterVoiceName()
	local data = {		
		["characters/actions/page_turn"] = "读书翻页声",
		["characters/trident_attack"] = "三叉戟攻击（炸鱼）",
		["characters/perd_shride_place"] = "未使用",
		["characters/player_revive"] = "未使用",

		["^song"] = "战斗歌谣",
		["^friendship_music"] = "好感度音乐",
		["^house"] = "隐士小屋相关音效",
		["^watch"] = "怀表相关音效",
		["^woby"] = "沃比相关音效",
		["^abigail"] = "阿比盖尔相关音效",
		["^slingshot"] = "弹弓相关音效"
	}
	return {
		others = function(path)
			for _,prefix in ipairs{"song", "friendship_music", "house", "watch", 
				"woby", "abigail", "slingshot"}do

				if path:find("^characters/[^/]+/"..prefix.."/") then
					return data["^"..prefix]
				end
			end
			
			if data[path] ~= nil then
				return data[path]
			end
		end,
		talk_LP = "说话（循环）",
		death_voice = "死亡",
		sinking = "沉没/溺水",
		ghost_LP = "鬼魂（循环）",
		yawn = "打哈欠",
		hurt = "受伤/遭到攻击",
		pose = "摆姿势",
		carol = "颂歌",
		emote = "做表情",
		eye_rub_vo = " ",
	}
end

return HumanAnnotator