import { AnimState } from "../../components/AnimCore_Canvas/animstate"
import { useAnimStateHook } from "../../components/AnimCore_Canvas/animhook"
import { createContext } from "react"

interface AnimStateContext extends ReturnType<typeof useAnimStateHook> {
  animstate: AnimState,
}

const animstateContext = createContext<AnimStateContext>(null)
export default animstateContext