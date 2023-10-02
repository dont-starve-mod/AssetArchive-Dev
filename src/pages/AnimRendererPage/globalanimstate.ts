import { AnimState } from "../../components/AnimCore_Canvas/animstate"
import { useAnimStateHook } from "../../components/AnimCore_Canvas/animhook"
import { createContext } from "react"
import { AssetState } from "../../components/AssetManager"
import { RenderParams } from "../../components/AnimCore_Canvas/renderparams"

interface AnimStateContext extends ReturnType<typeof useAnimStateHook> {
  animstate: AnimState,
  assetstate: AssetState,
  render: RenderParams,
}

const animstateContext = createContext<AnimStateContext>(null)
export default animstateContext