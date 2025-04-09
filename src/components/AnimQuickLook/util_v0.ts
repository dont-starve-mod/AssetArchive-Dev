import { v4 } from "uuid"
import smallhash from "../../smallhash"
import { checkCondition } from "./preset"
import "./preset"
import { BuildData } from "../AnimCore_Canvas/animcore"
import { AnimState, Api } from "../AnimCore_Canvas/animstate"
import { useSelector } from "../../redux/store"
import { useCallback, useMemo } from "react"
import { save } from "@tauri-apps/plugin-dialog"
import { useLuaCall } from "../../hooks"

/** quicklook preset type
 * # Example:
 * ```
 * {
 *   title: "火腿棒",
 *   type: "equip.hand",
 *   cmds: [OverrideSymbol, Show, Hide]
 * }
 * ```
 */
export type Preset = {
  key: string,
  title?: string,
  type: "character_base" | "equip_head" | "equip_hand" | "equip_body" | "character_action" |
    "mount" | "saddle" |
    "pig_base",
  icon?: string,
  cmds: Api[],
}

const createHatCmds = (name: string, openTop?: boolean): any[]=> {
  return [
    {name: "OverrideSymbol", args: ["swap_hat", "hat_" + name, "swap_hat"]},
    ...(openTop ? ["hair_hat", "head_hat"] : ["hair_nohat", "hair", "head"]).map(v=>
      ({name: "Hide", args: [v]}))
  ]
}

export const ALL_PRESETS: Preset[] = [
  // type=character_base
  // change basic build of wilson/wilsonbeefalo/equips puppet
  {
    key: "wilson",
    title: "威尔逊",
    type: "character_base",
    cmds: [
      {name: "SetBuild", args: ["wilson"]}
    ]
  },
  {
    key: "wendy",
    title: "温蒂",
    type: "character_base",
    cmds: [
      {name: "SetBuild", args: ["wendy"]}
    ]
  },
  {
    key: "wx78",
    title: "WX-78",
    type: "character_base",
    cmds: [
      {name: "SetBuild", args: ["wx78"]},
    ]
  },
  // type=equip_hand
  {
    key: "equip_hand_nothing",
    title: "空手",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_carry"]},
    ]
  },
  {
    key: "spear",
    title: "长矛",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]},
      {name: "OverrideSymbol", args: ["swap_object", "swap_spear", "swap_spear"]},
    ]
  },
  {
    key: "hambat",
    title: "火腿棒",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]},
      {name: "OverrideSymbol", args: ["swap_object", "swap_ham_bat", "swap_ham_bat"]},
    ]
  },
  {
    key: "ruins_bat",
    title: "铥矿棒TODO:",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]},
      {name: "OverrideSymbol", args: ["swap_object", "swap_ruins_bat", "swap_ruins_bat"]},
    ]
  },
  {
    key: "cane",
    title: "步行手杖",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]},
      {name: "OverrideSymbol", args: ["swap_object", "swap_cane", "swap_cane"]},
    ]
  },
  {
    key: "axe",
    title: "斧头",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]},
      {name: "OverrideSymbol", args: ["swap_object", "swap_axe", "swap_axe"]},
    ]
  },
  {
    key: "axe_invisible",
    title: "仿真斧头",
    type: "equip_hand",
    cmds: [
      {name: "Hide", args: ["arm_normal"]}
    ]
  },
  // type=equip_head
  {
    key: "equip_head_nothing",
    title: "未穿戴",
    type: "equip_head",
    cmds: [
      {name: "Hide", args: ["hat"]},
      {name: "Hide", args: ["hair_hat"]},
      {name: "Hide", args: ["head_hat"]},
    ],
  },
  {
    key: "straw",
    title: "草帽",
    type: "equip_head",
    cmds: createHatCmds("straw"),
  },
  {
    key: "beefalo",
    title: "牛角帽",
    type: "equip_head",
    cmds: createHatCmds("beefalo"),
  },
  {
    key: "top",
    title: "高礼帽",
    type: "equip_head",
    cmds: createHatCmds("top"),
  },
  {
    key: "football",
    title: "",
    type: "equip_head",
    cmds: createHatCmds("football"),
  },
  {
    key: "ruins",
    title: "铥矿冠",
    type: "equip_head",
    cmds: createHatCmds("ruins", true),
  },
  {
    key: "flower",
    title: "花环",
    type: "equip_head",
    cmds: createHatCmds("flower", true),
  },
  {
    key: "mask_doll",
    title: "面具",
    type: "equip_head",
    cmds: createHatCmds("mask_doll"),
  },
  // type=equip_body
  {
    key: "equip_body_nothing",
    title: "未穿戴",
    type: "equip_body",
    cmds: [],
  },
  {
    key: "backpack",
    title: "背包",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body", "swap_backpack", "swap_body"]},
      {name: "OverrideSymbol", args: ["backpack", "swap_backpack", "backpack"]},
    ],
  },
  {
    key: "krampus_sack",
    title: "坎普斯包",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body", "swap_krampus_sack", "swap_body"]},
      {name: "OverrideSymbol", args: ["backpack", "swap_krampus_sack", "backpack"]},
    ]
  },
  {
    key: "armorwood",
    title: "木甲",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body", "armor_wood", "swap_body"]},
    ]
  },
  {
    key: "armorruins",
    title: "铥矿甲",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body", "armorruins", "swap_body"]},
    ]
  },
  {
    key: "amulet",
    title: "重生护符",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body", "torso_amulets", "redamulet"]},
    ]
  },
  {
    key: "onemanband",
    title: "独奏乐器",
    type: "equip_body",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_body_tall", "armor_onemanband", "swap_body_tall"]},
    ]
  },
  // type=character_action
  {
    key: "character_idle",
    title: "空闲",
    type: "character_action",
    cmds: [
      {name: "SetBankAndPlayAnimation", args: ["wilson", "idle_loop"]}
    ]
  },
  {
    key: "character_running",
    title: "赶路",
    type: "character_action",
    cmds: [
      {name: "SetBankAndPlayAnimation", args: ["wilson", "run_loop"]}
    ]
  },
  {
    key: "character_attack",
    title: "攻击",
    type: "character_action",
    cmds: [
      {name: "SetBankAndPlayAnimation", args: ["wilson", "attack"]}
    ],
  },
  {
    key: "character_dance",
    title: "我去！我喜欢跳舞！",
    type: "character_action",
    cmds: [
      {name: "SetBankAndPlayAnimation", args: ["wilson", "emoteXL_loop_dance0"]}
    ]
  },
  // type=mount
  // change override build when riding
  {
    key: "mount_nothing",
    title: "虚空",
    type: "mount",
    cmds: []
  },
  {
    key: "beefalo",
    title: "牛",
    type: "mount",
    cmds: [
      {name: "AddOverrideBuild", args: ["beefalo_build"]}
    ]
  },
  {
    key: "wobybig",
    title: "沃比",
    type: "mount",
    cmds: [
      {name: "AddOverrideBuild", args: ["woby_big_build"]}
    ]
  },
  // type=saddle
  {
    key: "saddle_basic",
    title: "鞍",
    type: "saddle",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_saddle", "saddle_basic", "swap_saddle"]},
    ],
  },
  {
    key: "saddle_war",
    title: "战鞍",
    type: "saddle",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_saddle", "saddle_war", "swap_saddle"]},
    ],
  },
  {
    key: "saddle_race",
    title: "速鞍",
    type: "saddle",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_saddle", "saddle_race", "swap_saddle"]},
    ],
  },
  {
    key: "saddle_wathgrithr",
    title: "女武神鞍",
    type: "saddle",
    cmds: [
      {name: "OverrideSymbol", args: ["swap_saddle", "saddle_wathgrithr", "swap_saddle"]},
    ],
  },
  {
    key: "pig",
    title: "猪人",
    type: "pig_base",
    icon: "pigman",
    cmds: [
      {name: "SetBuild", args: ["pig_build"]}
    ]
  },
  // {
  //   key: "rabbit",
  //   title: "兔人",
  //   type: "pig_base",
  //   icon: "bunnyman",
  //   cmds: [
  //     {name: "SetBuild", args: ["manrabbit_build"]}
  //   ]
  // },
  {
    key: "merm",
    title: "鱼人",
    type: "pig_base",
    cmds: [
      {name: "SetBuild", args: ["merm_build"]}
    ]
  },
]

const ALL_PRESETS_GROUPS = {}
ALL_PRESETS.forEach((preset)=> {
  const {key, type, cmds} = preset
  if (!Array.isArray(ALL_PRESETS_GROUPS[type])){
    ALL_PRESETS_GROUPS[type] = []
  }
  ALL_PRESETS_GROUPS[type].push(preset)
  cmds.forEach(v=> {
    // create new uuid
    // v.uuid = `${key}@${v4()}`
  })
})

const PRESET_TYPE_DEFS: {
  [K in Preset["type"]]: {
    order?: number,
    type?: string,
    title: string,
    filter: (data: any)=> boolean,
  }
} = {
  character_base: {
    order: 0,
    title: "角色外观",
    filter: ({bank})=> bank === smallhash("wilson") || bank === smallhash("wilsonbeefalo")
  },
  equip_hand: {
    order: 100,
    title: "工具/武器",
    filter: ({bank})=> bank === smallhash("wilson") || bank === smallhash("wilsonbeefalo")
  },
  equip_head: {
    order: 101,
    title: "帽子/头盔",
    filter: ({bank})=> bank === smallhash("wilson") || bank === smallhash("wilsonbeefalo")
  },
  equip_body: {
    order: 102,
    title: "背包/护甲",
    filter: ({bank})=> bank === smallhash("wilson") || bank === smallhash("wilsonbeefalo")
  },
  character_action: {
    order: 1,
    title: "角色动作",
    filter: ({build})=> false,
  },
  mount: {
    order: 200,
    title: "坐骑",
    filter: ({bank})=> bank === smallhash("wilsonbeefalo")
  },
  saddle: {
    order: 201,
    title: "鞍",
    filter: ({bank})=> bank === smallhash("wilsonbeefalo")
  },
  pig_base: {
    title: "“猪人”外观",
    order: 0,
    filter: ({bank})=> bank === smallhash("pigman")
  },
}

Object.entries(PRESET_TYPE_DEFS).forEach(([k, v])=> v.type = k)

type DataExt = {
  is_wilson?: boolean,
  is_wilsonbeefalo?: boolean,
  is_character?: boolean,
  is_pigman?: boolean,
}

export function useQuickLookPresets(
  data: {bank: string | number, animation: string, build: string} & DataExt) {
  return useMemo(()=> {
    if (data.bank !== undefined && data.animation !== undefined){
      const bankHash = smallhash(data.bank)
      data.bank = bankHash
      // add util flags
      data.is_wilson = bankHash === smallhash("wilson")
      data.is_wilsonbeefalo = bankHash === smallhash("wilsonbeefalo")
      data.is_character = data.is_wilson || data.is_wilsonbeefalo
      data.is_pigman = bankHash === smallhash("pigman")
    }
    else if (data.build !== undefined){
  
    }
    // collect preset types
    const result = Object.values(PRESET_TYPE_DEFS).map(
      v=> ({
        type: v.type,
        order: v.order,
        title: v.title,
        activated: v.filter(data),
        presets: ALL_PRESETS_GROUPS[v.type] as Preset[],
      })
    )
    const getValue = v=> (v.activated ? -10000 : 0) + (v.order || 0)
    result.sort((a, b)=> getValue(a) - getValue(b))
    // collect preset items
    
    console.log(result)
    return result
  }, [])
}

export function useQuickLookCmds(
  data: {bank: string | number, animation: string, build: string} & DataExt
) {
  const stored_presets = useSelector(({localstorage})=> localstorage.quicklook_presets)
  const presets = useQuickLookPresets(data)
  return useMemo(()=> {
    const list = [] as Api[]
    presets.forEach(v=> {
      const {type, presets, activated} = v
      if (activated){
        const preset = presets.find(v=> stored_presets[v.key]) || presets[0]
        const cmds = preset.cmds.map(v=> JSON.parse(JSON.stringify(v)))
        list.push(...cmds)
      }
    })
    return list
  }, [stored_presets, presets])
}

type ExportFormat = "gif" | "mp4" | "snapshot"

export function useQuickLookExport(
  animstate: AnimState, defaultName?: string
) {
  defaultName = defaultName || "export"
  const call = useLuaCall("render_animation_sync", ()=> {}, {}, [])
  return useCallback(async (format: ExportFormat)=> {
    animstate.pause()
    const path = await save({
      title: "",
      defaultPath: `${defaultName}.${format === "snapshot" ? "png" : format}`
    })
    if (typeof path !== "string") throw Error("path not provided")
    if (!animstate.hasFrameList) throw Error("animation not valid")
    
    const session_id = "quicklook_export"
    call({
      session_id,
      path,
      api_list: animstate.getValidApiList(),
      render_param: {
        scale: 1.0,
        rate: 30,
        format,
        facing: animstate.getActualFacing(),
        bgc: format === "mp4" ? "#cccccc" : "transparent",
        current_frame: animstate.currentFrame,
        skip_index: true,
      }
    })
  }, [animstate, call])
}