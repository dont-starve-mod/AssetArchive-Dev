require "strict"
require "util"
json = require "json"
require "ipc"
require "constants"
require "debugprint"
require "stacktrace"
require "class"
require "persistant"
require "affine"
require "hashlib"
require "filesystem"
require "asset"
require "facing"
require "assetloader"
require "richtext"
require "entry"
require "color"
local Renderer = require "renderer"
local AssetIndex = require "assetindex"
local DST_DataRoot =  require "assetprovider".DST_DataRoot
local Provider =  require "assetprovider".Provider
local AnimProjectManager = require "animproject".AnimProjectManager

if Args then
	require "cli"
end

GLOBAL = {
	root = nil,
	prov = nil,
}


IpcHandlers.Register("appinit", function()
	-- Events:
	--   settings
	--   root
	--   index_progress 0..100
	--   anim_predictable_data
	--   assets
	
	IpcEmitEvent("settings", Persistant.Config:Dumps()) -- get settings first

	GLOBAL.root = DST_DataRoot()
	if not GLOBAL.root:IsValid() then
		IpcEmitEvent("update_setting", json.encode_compliant({
			key = "last_dst_root", 
			value = "",
		}))
		return
	end
	GLOBAL.prov = Provider(GLOBAL.root)
	GLOBAL.prov:DoIndex(false)
	GLOBAL.prov:ListAsset()

	GLOBAL.projectmanager = AnimProjectManager(APP_DATA_DIR/"animproject")

	return {
		success = true,
	}
end)

IpcHandlers.Register("setroot", function(param)
	if GLOBAL.root:SetRoot(param.path) then
		IpcEmitEvent("update_setting", json.encode_compliant({
			key = "last_dst_root",
			value = param.path,
		}))
		GLOBAL.prov = Provider(GLOBAL.root)
		GLOBAL.prov:DoIndex(true)
		GLOBAL.prov:ListAsset()
		return true
	else
		return false
	end
end)

IpcHandlers.Register("showroot", function()
	return GLOBAL.root:OpenRootFolder()
end)

IpcHandlers.Register("load", function(param)
	-- type     build|animation|atlas|image|xml|symbol_element
	-- rw       <number>
	-- rh       <number>
	-- format   rgba|img|png|copy|save
	-- 
	-- xml[type=image]
	-- tex[type=image]
	assert(type(param) == "table", "Ipc<load> only accept table param")
	local result = GLOBAL.prov:Load(param)
	if param.result_type ~= nil and type(result) ~= param.result_type then
		error("Ipc<load> result type failed to match, expect "..param.result_type..", got "..type(result)
			.."\n"..json.encode_compliant(param))
	end

	return result
end)

IpcHandlers.Register("copy", function(text)
	if type(text) == "string" then
		return Clipboard.WriteText(text)
	end
end)

IpcHandlers.Register("animproject.init", function(param)
	return {
		anim_predictable_data = GLOBAL.prov.index:Ipc_GetPredictableData(),
	}
end)

IpcHandlers.Register("animproject", function(param)
	return GLOBAL.projectmanager:OnIpc(param)
end)

IpcHandlers.Register("render_animation_sync", function(param)
	local r = Renderer(param.api_list)
	r.path = assert(param.path, "path not provided")
	r:SetRoot(GLOBAL.root)
	r:SetRenderParam(param.render_param)
	r:Run()
end)

IpcHandlers.Register("debug_analyze", function()
	local main = require("compiler.amain").main
	main(GLOBAL)
end)