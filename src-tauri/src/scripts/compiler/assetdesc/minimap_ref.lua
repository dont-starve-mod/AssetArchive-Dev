local PREFAB_REDIRECT = {
	farm1 = "farmplot",
	farm2 = "slow_farmplot",
	farm3 = "fast_farmplot",
	portal_dst = "multiplayer_portal",
	wormhole_sick = "wormhole",
	wormhole_lureplant = "wormhole",
	wormhole_claw = "wormhole",
	wormhole_fantasy = "wormhole",
	wormhole_spider = "wormhole",
	wormhole_gothic = "wormhole",
	wormhole_worm = "wormhole",
	portablespicer = "portablespicer_item",
	portableblender = "portableblender_item",
	portablecookpot = "portablecookpot_item",

	whitespider_den = "spider_dropper",

	flare = "miniflare",
	flare2 = "megaflare",
	flare3 = "megaflare",

	winter_deciduoustree = "winter_tree",
	winter_palmconetree = "winter_tree",
	winter_twiggytree = "winter_tree",

	barnacle_rock = "seastack", -- 这是一个类似于洞穴蠕虫的伪装，可能得再看看
	statue_ruins = "ancient_statue",
	oasis_cactus = "cactus",
	driftwood_small1 = "driftwood_tree",
}

local function FindMinimapRef(prefabdata)
	local prefabs = prefabdata.prefabs
	local ref = {}
	for _,v in ipairs(prefabs)do
		local prefab = v.name
		for _,asset in ipairs(v.assets)do
			if asset.type == "MINIMAP_IMAGE" then
				local name = NameOf(asset.file)
				if ref[name] == nil then
					ref[name] = {}
				end
				table.insert(ref[name], prefab)
			end
		end
	end
	for name,v in pairs(PREFAB_REDIRECT)do
		if ref[name] == nil then
			ref[name] = {v}
		else
			table.insert(ref[name], v)
		end
	end
	return ref
end

local function minimap_ref(env)
	local prefabdata = assert(env.prefabdata)
	return {
		ref = FindMinimapRef(prefabdata)
	}
end

return minimap_ref
