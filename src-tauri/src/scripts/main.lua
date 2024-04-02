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
require "ffmpeg"
local Renderer = require "renderer"
local AssetIndex = require "assetindex"
local DST_DataRoot =  require "assetprovider".DST_DataRoot
local Provider =  require "assetprovider".Provider
local AnimProjectManager = require "animproject".AnimProjectManager
require "cli"

GLOBAL = {
	root = nil,
	prov = nil,
}

local function SendData()
	print("Start emitting data to frontend...")

	IpcEmitEvent("docs", table.concat({
		"assets", json.encode_compliant(GLOBAL.prov.assets),
		"assetdesc", require "compiler.output.assetdesc",
		"entry", require "compiler.output.entry",
		"animpreset", require "compiler.output.animpreset",
		"tags", require "compiler.output.entry_tags",
	}, TEXT_GUARD))

	-- IpcEmitEvent("assets", json.encode_compliant(GLOBAL.prov.assets))
	-- IpcEmitEvent("assetdesc", require "compiler.output.assetdesc")
	-- IpcEmitEvent("entry", require "compiler.output.entry")
	-- IpcEmitEvent("animpreset", require "compiler.output.animpreset")
	-- IpcEmitEvent("entry_tags", require "compiler.output.entry_tags")

	print("All data sent")
end

IpcHandlers.Register("appinit", function()
	-- Events:
	--   settings
	--   root
	--   index_progress 0..100
	--   anim_predictable_data
	
	IpcEmitEvent("settings", Persistant.Config:Dumps()) -- get settings first

	GLOBAL.root = DST_DataRoot()
	GLOBAL.projectmanager = AnimProjectManager(APP_DATA_DIR/"animproject")
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
	SendData()

	return {
		success = true,
	}
end)

-- IpcHandlers["appinit"]("{}")

IpcHandlers.Register("setroot", function(param)
	if GLOBAL.root:SetRoot(param.path) then
		IpcEmitEvent("update_setting", json.encode_compliant({
			key = "last_dst_root",
			value = param.path,
		}))
		GLOBAL.prov = Provider(GLOBAL.root)
		GLOBAL.prov:DoIndex(true)
		GLOBAL.prov:ListAsset()
		SendData()
		return true
	else
		return false
	end
end)

IpcHandlers.Register("showroot", function()
	return GLOBAL.root:OpenRootFolder()
end)

IpcHandlers.Register("load", function(param)
	assert(type(param) == "table", "Ipc<load> only accept table param")
	local result = GLOBAL.prov:Load(param)
	if param.result_type ~= nil and type(result) ~= param.result_type then
		error("Ipc<load> result type failed to match, expect "..param.result_type..", got "..type(result)
			.."\n"..json.encode_compliant(param))
	end

	return result
end)

IpcHandlers.Register("batch_download", function(param)
	assert(type(param) == "table", "Ipc<batch_download> only accept table param")
	local result = GLOBAL.prov:BatchDownload(param)
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
	r.session_id = assert(param.session_id, "session_id not provided")

	r:SetRenderParam(param.render_param)
	r:SetRoot(GLOBAL.root)
	r:Run()
end)

IpcHandlers.Register("debug_analyze", function()
	local main = require("compiler.amain").main
	main(GLOBAL)
end)