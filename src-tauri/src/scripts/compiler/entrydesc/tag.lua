local known_tags = {
	"armor",
	"armor_planardefense",
	"burnable",
	"crafted_by.walter",
	"crafted_by.wanda",
	"crafted_by.warly",
	"crafted_by.wathgrithr",
	"crafted_by.waxwell",
	"crafted_by.webber",
	"crafted_by.wendy",
	"crafted_by.wes",
	"crafted_by.wickerbottom",
	"crafted_by.willow",
	"crafted_by.winona",
	"crafted_by.wolfgang",
	"crafted_by.woodie",
	"crafted_by.wormwood",
	"crafted_by.wurt",
	"crafted_by.wx78",
	"dapperness+",
	"dapperness-",
	"finiteuses",
	"fishable",
	"fishing",
	"food.burnt",
	"food.elemental",
	"food.gears",
	"food.generic",
	"food.goodies",
	"food.horrible",
	"food.meat",
	"food.raw",
	"food.roughage",
	"food.seeds",
	"food.veggie",
	"food.wood",
	"fuel.burnable",
	"fuel.cave",
	"fuel.chemical",
	"fuel.lighter",
	"fuel.nightmare",
	"fuel.wormlight",
	"fuled_by.burnable",
	"fuled_by.cave",
	"fuled_by.chemical",
	"fuled_by.lighter",
	"fuled_by.magic",
	"fuled_by.nightmare",
	"fuled_by.onemanband",
	"fuled_by.pigtorch",
	"fuled_by.usage",
	"fuled_by.wormlight",
	"healthvalue+",
	"healthvalue-",
	"hungervalue+",
	"hungervalue-",
	"insulator.summer",
	"insulator.winter",
	"lightbattery",
	"lunar_aligned",
	"perishable",
	"pickable",
	"planardamage",
	"rangedweapon",
	"sanityaura",
	"sanityvalue+",
	"sanityvalue-",
	"sewable",
	"shadow_aligned",
	"stackable",
	"subcat.armor",
	"subcat.atrium",
	"subcat.backpack",
	"subcat.battlesong",
	"subcat.bird",
	"subcat.book",
	"subcat.clockwork",
	"subcat.clothing",
	"subcat.container",
	"subcat.costume",
	"subcat.craftingstation",
	"subcat.element",
	"subcat.elixer",
	"subcat.farmplant",
	"subcat.halloweenornament",
	"subcat.hat",
	"subcat.hauntedtoy",
	"subcat.hound",
	"subcat.insect",
	"subcat.merm",
	"subcat.mutator",
	"subcat.oceanfish",
	"subcat.ornament",
	"subcat.pig",
	"subcat.pocketwatch",
	"subcat.riding",
	"subcat.seafaring",
	"subcat.shadow",
	"subcat.shell",
	"subcat.spider",
	"subcat.statue",
	"subcat.structure",
	"subcat.tackle",
	"subcat.tool",
	"subcat.tree",
	"subcat.trinket",
	"subcat.turf",
	"subcat.upgrademodule",
	"subcat.wagstafftool",
	"subcat.wall",
	"subcat.weapon",
	"subcat.wintersfeastfood",
	"tool",
	"waterproofer",
	"waterproofer_100",
	"weapon",
	"weapon_0_damage",
	"workable.chop",
	"workable.dig",
	"workable.hammer",
	"workable.mine",
	"workable.net",
}

local name_map = {
	stackable = "STRINGS.SCRAPBOOK.DATA_STACK",
	planardamage = "STRINGS.SCRAPBOOK.DATA_PLANAR_DAMAGE",
	lunar_aligned = "STRINGS.SCRAPBOOK.NOTE_LUNAR_ALIGNED",
	shadow_aligned = "STRINGS.SCRAPBOOK.NOTE_SHADOW_ALIGNED",

	fishable = "STRINGS.SCRAPBOOK.DATA_FISHABLE",
	pickable = "STRINGS.SCRAPBOOK.DATA_PICKABLE",
	harvestable = "STRINGS.SCRAPBOOK.DATA_HARVESTABLE",
	burnable = "STRINGS.SCRAPBOOK.DATA_BURNABLE",
	stewer = "STRINGS.SCRAPBOOK.DATA_STEWER",
	sewable = "STRINGS.SCRAPBOOK.DATA_SEWABLE",
	waterproofer = "STRINGS.SCRAPBOOK.DATA_WETNESS",
	lightbattery = "STRINGS.SCRAPBOOK.DATA_LIGHTBATTERY",

	["type.food"] = "STRINGS.SCRAPBOOK.CATS.FOOD",
	["type.poi"] = "STRINGS.SCRAPBOOK.CATS.POI",

	finiteuses = "次数耐久度",
	fueled = "时间耐久度/可填充燃料",
	fuel = "燃料",
	waterproofer_100 = "完全防水",
	weapon = "武器",
	rangedweapon = "远程武器",
	weapon_0_damage = "无伤害武器",
	tool = "工具",
	armor = "护甲",
	armor_planardefense = "STRINGS.SCRAPBOOK.DATA_PLANAR_DEFENSE",
	sanityaura = "理智光环",
	perishable = "易腐烂",
	["insulator.winter"] = "防寒冬装",
	["insulator.summer"] = "隔热夏装",
	fishing = "诱饵",
	preparedfood = "料理",

	-- +/-
	healthvalue = "生命值",
	hungervalue = "饥饿值",
	sanityvalue = "理智值",
	dapperness = "理智值（穿戴）",
}

local function GetTagName(po, v)
	if name_map[v] ~= nil then
		if name_map[v]:startswith("STRINGS") then
			return assert(po(name_map[v]), v)
		else
			return name_map[v]
		end
	end

	local iter = v:gmatch("([^.]+)")
	local v1 = iter()
	local v2 = iter()
	if v1 == "subcat" then
		return assert(po("STRINGS.SCRAPBOOK.SUBCATS."..v2:upper()))
	elseif v1 == "type" then
		return assert(po("STRINGS.SCRAPBOOK.CATS."..v2:upper().."S"), v)
	elseif v1 == "workable" then
		if v2 == "net" then
			return "可捕捉"
		else
			return assert(po("STRINGS.SCRAPBOOK.DATA_WORKABLE_"..v2:upper()))
		end
	elseif v1 == "food" then
		return assert(po("STRINGS.SCRAPBOOK.FOODTYPE."..v2:upper())).."食物"
	elseif v1 == "crafted_by" then
		return "专属物品-"..assert(po:GetName(v2))
	elseif v1:endswith("+") then
		return "回复"..name_map[v1:sub(1, #v1 - 1)]
	elseif v1:endswith("-") then
		return "消耗"..name_map[v1:sub(1, #v1 - 1)]
	elseif v1:startswith("fuel") then
		return "#REMOVE"
	end
end

return {
	GetTagName = GetTagName,
}