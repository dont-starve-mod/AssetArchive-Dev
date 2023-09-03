-- predefine some entries

local CHINESE_NUMBER = {
	"一", "二", "三", "四", "五"
}

local function GetAlias2(key, po)
	local FORGE = po("STRINGS.UI.FESTIVALEVENTSCREEN.TITLE.LAVAARENA")
	local GORGE = po("STRINGS.UI.FESTIVALEVENTSCREEN.TITLE.QUAGMIRE")

	if key == "blowdart_lava"then
		return {
			string.format("%s（%s）", po:GetName(key), FORGE),
			string.format("%s%s", FORGE, po:GetName(key))
		}
	end
	if key:startswith("lavaarena_")then
		local name = po:GetName(key)
		if name then
			return { string.format("%s（%s）", name, FORGE) }
		end
	end
	if key:startswith("quagmire_")then
		if key:startswith("quagmire_food_") and tonumber(key:sub(14,16)) ~= nil then
			return { string.format("%s（%s）", po:GetName(key), GORGE) }
		end	
		if po:GetName(key) then
			return { string.format("%s（%s）", po:GetName(key), GORGE) }
		end
	end
	if key:match("alterguardian_phase%d$") then
		local index = #"alterguardian_phase"+1
		return { string.format("%s（%s阶段）", po:GetName(key), CHINESE_NUMBER[tonumber(key:sub(index, index))]) }
	end
	if key == "alterguardian_phase3dead"then
		return { po:GetName(key).. "（被击败）" }
	end
	if key == "carrat_planted"then
		return { po:GetName("carrat") }
	end
	if key == "walkingplank" or key == "walkingplank_grass" then
		return { po:GetName(key).."（船上的）" }
	end
end

local PREDEF_ALIAS_GROUP = {
	{"berrybush", "berrybush2"},
	{"cane_candycane", "winter_food3"},
	{"gestalt", "gestalt_alterguardian_projectile"},
	{"gestalt_guard", "largeguard_alterguardian_projectile"},
	{"houndfire", "fire"},
	{"lava_pond_rock", "cavein_boulder"},
	{
		"pigelitefighter1", "pigelite1",
		"pigelitefighter2", "pigelite2",
		"pigelitefighter3", "pigelite3",
		"pigelitefighter4", "pigelite4",
	},
	{"stageusher", "stagehand"},
	{"statue_marble", "sculpture_rookbody", "sculpture_knightbody", "sculpture_bishopbody"},
}

return {
	GetAlias2 = GetAlias2,
	PREDEF_ALIAS_GROUP = PREDEF_ALIAS_GROUP,
}