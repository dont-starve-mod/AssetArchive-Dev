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
local AssetIndex = require "assetindex"
local DST_DataRoot =  require "assetprovider".DST_DataRoot
local Provider =  require "assetprovider".Provider

if Args then
	require "cli"
end

GLOBAL = {
	root = nil,
	prov = nil,
}

IpcHandlers.Register("appinit", function()
	-- Events:
	--   allconfig
	--   root
	--   index_progress 0..100
	--   hash
	--   assets
	
	IpcEmitEvent("allconfig", Persistant.Config:Dumps()) -- get config first

	GLOBAL.root = DST_DataRoot()
	if not GLOBAL.root:IsValid() then
		IpcEmitEvent("root", "")
		return
	end
	GLOBAL.prov = Provider(GLOBAL.root)
	GLOBAL.prov:DoIndex(false)
	GLOBAL.prov:ListAsset()

	return {
		success = true,
	}
end)

IpcHandlers.Register("setroot", function(path)
	if GLOBAL.root:SetRoot(path) then
		GLOBAL.prov = Provider(GLOBAL.root)
		GLOBAL.prov:DoIndex(true)
		return true
	else
		return false
	end
end)

IpcHandlers.Register("load", function(param)
	-- type     build|animation|atlas|image|xml|symbol_element
	-- rw       <number>
	-- rh       <number>
	-- format   rgba|img|png|copy|save
	-- 
	-- xml[type=image]
	-- tex[type=image]
	return GLOBAL.prov:Load(param)
end)

IpcHandlers.Register("copy", function(text)
	if type(text) == "string" then
		return Clipboard.WriteText(text)
	end
end)

IpcHandlers.Register("debug_analyze", function()
	local main = require("compiler.amain").main
	main(GLOBAL)
end)