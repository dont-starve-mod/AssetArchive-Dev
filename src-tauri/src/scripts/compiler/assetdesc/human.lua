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
	local list = self.data[asset]
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

return HumanAnnotator