local PREFAB_REDIRECT = {
	farm1 = "farmplot",
	farm2 = "slow_farmplot",
	farm3 = "fast_farmplot",
	portal_dst = "multiplayer_portal",
	wormhole_sick = "wormhole",
	wormhole_lureplant = "wormhole",
	wormhole_claw = "wormhole",
	wormhole_fantasy = "wormhole",
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
					if PREFAB_REDIRECT[name] then
						table.insert(ref[name], PREFAB_REDIRECT[name])
					end
				end
				table.insert(ref[name], prefab)
			end
		end
	end
	return ref
end

local function minimap_desc(env)
	local prefabdata = assert(env.prefabdata)
	return {
		ref = FindMinimapRef(prefabdata)
	}
	--
end

return minimap_desc
