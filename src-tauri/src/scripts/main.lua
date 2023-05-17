-- print(package.path)
-- print(package.cpath)
require "strict"
require "util"
json = require "json"
require "ipc"
require "constants"
require "debugprint"
require "class"
require "hashlib"
require "filesystem"
require "assetloader"
require "assetprovider"

-- local i = Image.From_RGBA(string.rep("\255\0\0\255", 50*50*5), 50,50)
-- timeit(1)
-- local j = i:affine_transform(50, 50, {0.86,0.5,-0.5,0.86,-.20,-.20}, 1)
-- timeit()
-- local k = i:affine_transform(50, 50, {0.86,0.5,-0.5,0.86,-0,-0}, 0)
-- timeit()
-- j:save("out-bili.png")
-- k:save("out-near.png")
-- local b = k:save_png_bytes()
-- print(#b)
-- local j = (json.encode({file = b}))
-- local f = json.decode(j).file
-- print(f == b)
-- exit()

require "assetindex"