-- scrapbook animation preview generater

local root = nil
local prov = nil
local Path = FileSystem.Path

local function GeneratePreviewSnapshot(list, use_cache)
	local Renderer = require "renderer"
	for k,v in pairs(list)do
		local api_list = {
			{name = "SetBuild", args = {assert(v.build)}},
			{name = "SetBankAndPlayAnimation", args = {assert(v.bank), assert(v.anim)}},
		}
		if v.overridebuild then
			assert(type(v.overridebuild) == "string")
			table.insert(api_list, 
				{name = "AddOverrideBuild", args = {v.overridebuild}})
		end
		if v.overridesymbol then
			if type(v.overridesymbol[1]) ~= "table" then
				v.overridesymbol = { v.overridesymbol }
			end
			for _, args in ipairs(v.overridesymbol)do
				table.insert(api_list,
					{name = "OverrideSymbol", args = args})
				if args[4] ~= nil then
					table.insert(api_list, 
						{name = "SetSymbolMultColour", args = {args[1], 1, 1, 1, tonumber(args[4])}})
				end
			end
		end
		if v.hidesymbol then
			for _, name in ipairs(v.hidesymbol)do
				table.insert(api_list, 
					{name = "HideSymbol", args = {name}})
			end
		end
		if v.hide then
			for _, name in ipairs(v.hide)do
				table.insert(api_list, 
					{name = "Hide", args = {name}})
			end
		end
		if v.alpha then
			table.insert(api_list,
				{name = "SetMultColour", args = {1, 1, 1, tonumber(v.alpha)}})
		end

		local r = Renderer(api_list)
		r.skip_index = true
		r.provider = prov
		r.format = "snapshot"
		r.current_frame_percent = v.animpercent or 0 -- klei use rand() here
		if v.facing ~= nil then
			r.facing = v.facing
		else
			r.facing = "#default" -- use smallest index (right as default)
		end
		r.bgc = "transparent"
		r.path = SCRIPT_ROOT.."compiler/output/preview/"..k..".png"

		if not use_cache or not Path(r.path):is_file() then
			r:Run()
		end

		-- convert to thumbnail
		local thumbnail_size = 100
		local path1 = r.path
		local path2 = r.path:gsub("/preview/", "/preview_thumbnail/")
		local img = Image.Open(path1)
		local w, h = img:size()
		
		local mult = thumbnail_size / math.max(w, h)
		if mult < 1 then
			w = mult* w
			h = mult* h
			img = img:resize(w, h, Image.BILINEAR)
		end
		img:save(path2, true)
	end
end

local function main(env)
	-- root = env.root -- assign "global" var
	prov = env.prov -- assign "global" var

	local list = json.decode(require "compiler/output/anim_preview_list")
	GeneratePreviewSnapshot(list, not Args.disable_preview_cache 
		-- and false
	)
end

return {
	main = main
}