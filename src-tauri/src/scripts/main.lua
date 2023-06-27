require "strict"
require "util"
json = require "json"
require "ipc"
require "constants"
require "debugprint"
require "class"
require "persistant"
require "hashlib"
require "filesystem"
require "asset"
require "assetloader"
local AssetIndex = require "assetindex"
local DST_DataRoot =  require "assetprovider".DST_DataRoot
local Provider =  require "assetprovider".Provider

GLOBAL = {
	root = nil,
	prov = nil,
}

--[[
/Users/wzh/DST/data的替身
/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents
]]

IpcHandlers.Register("appinit", function()
	-- Events:
	--   allconfig
	--   root
	--   index_progress 0..100
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
	-- format   rgba|img|png|copy
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
	local main = (require "compiler.amain").main
	main(GLOBAL)
end)