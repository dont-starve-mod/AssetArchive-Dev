export const FACING_RIGHT        = 1 << 0
export const FACING_UP           = 1 << 1
export const FACING_LEFT         = 1 << 2
export const FACING_DOWN         = 1 << 3
export const FACING_UPRIGHT      = 1 << 4
export const FACING_UPLEFT       = 1 << 5
export const FACING_DOWNRIGHT    = 1 << 6
export const FACING_DOWNLEFT     = 1 << 7
export const FACING_ALL          = (1 << 8) - 1
export const FACING_SIDE         = FACING_LEFT | FACING_RIGHT

export const FACING_ALIAS_MAP = {
  "up"        : FACING_UP, 
  "down"      : FACING_DOWN,
  "side"      : FACING_SIDE, 
  "left"      : FACING_LEFT,
  "right"     : FACING_RIGHT, 
  "upside"    : FACING_UPRIGHT | FACING_UPLEFT,
  "downside"  : FACING_DOWNLEFT | FACING_DOWNRIGHT, 
  "upleft"    : FACING_UPLEFT,
  "upright"   : FACING_UPRIGHT,
  "downleft"  : FACING_DOWNLEFT,
  "downright" : FACING_DOWNRIGHT,
  "45s"       : FACING_UPLEFT | FACING_UPRIGHT | FACING_DOWNLEFT | FACING_DOWNRIGHT,
  "90s"       : FACING_UP | FACING_DOWN | FACING_SIDE,

  "all"       : FACING_ALL,
}

export const facing2byte = facing => {
  if (facing === null || facing === undefined || typeof facing === "number"){
    return facing
  }
  else if (typeof facing !== "string"){
    console.error("Failed to resolve facing: ", facing)
    return null
  }
  else if (FACING_ALIAS_MAP[facing] !== undefined){
    return FACING_ALIAS_MAP[facing]
  }
  else if (facing.startsWith("f-")){
    return Number(facing.substring(2))
  }
  return facing
}

const _cache = {}
export const byte2facing = byte => {
  if (typeof _cache[byte] === "string") return _cache[byte]

  for (const facing in FACING_ALIAS_MAP){
    if (FACING_ALIAS_MAP[facing] === byte){
      _cache[byte] = facing
      return facing
    }
  }
  _cache[byte] = "f-"+byte
  return _cache[byte]
}