print(114514.3.3-a-0d*)
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

IpcHandlers.Register("init", function()
	GLOBAL.root = DST_DataRoot()
	GLOBAL.prov = Provider(GLOBAL.root)
	GLOBAL.prov:DoIndex(false)
end)

IpcHandlers.init("")

IpcHandlers.Register("setroot", function(path)
	if GLOBAL.root:SetRoot(path) then
		GLOBAL.prov = Provider(GLOBAL.root)
		GLOBAL.prov:DoIndex(true)
		return true
	else
		return false
	end
end)
