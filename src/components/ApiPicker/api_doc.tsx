import { Button, Icon, Tag } from "@blueprintjs/core"
import type { Api } from "../AnimCore_Canvas/animstate"
import style from './index.module.css'
import { Popover2, Tooltip2 } from "@blueprintjs/popover2"
import Code from "../Code"

type ApiDoc = {
  /** SetBank, SetBuild, ... */
  name?: string,
  /** "设置材质", ... */
  title?: string,
  desc?: React.ReactNode,
  desc_detail?: React.ReactNode,
  example?: React.ReactNode,
}

// @ts-ignore
export const API_DOC: {
  [K in Api["name"]]: ApiDoc
} = {}

const OVERRIDE_HINT = "如果重复使用该指令，只有最后的会生效"

API_DOC["SetBank"] = {
  title: "设置动画库",
  desc: (
    <>
      <p>设置动画库（Bank）的名字。</p>
      <p>动画库可以看作动画的分类或命名空间，用于区分不同生物的同类动作，
        如：猪人的「攻击」和疯猪的「攻击」，动画名字相同，但动画库名字不同，因此展现出了完全不同的视觉效果。</p>
      <p>动画库是唯一的，{OVERRIDE_HINT}。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>动画库名的数据类型是哈希（<SmallHashTypeHint/>），对大小写不敏感，
        因此，<code>SetBank("pigman")</code>和<code>SetBank("PigMan")</code>的执行效果完全一致。
      </p>
    </>
  )
}

API_DOC["SetBuild"] = {
  title: "设置材质",
  desc: (
    <>
      <p>设置材质（Build）的名字。</p>
      <p>材质决定了物体的基本形态和颜色，如：沃尔夫冈切换强壮状态、切斯特变身冰切、兔人黑化等，其本质都是材质的改变。
        <span className={style["spoiler"]}>俗称“换皮”。</span>
      </p>
      <p>材质是唯一的，{OVERRIDE_HINT}。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>材质名的数据类型是字符串（string），对大小写敏感，
        因此，<code>SetBuild("wilson")</code>和<code>SetBuild("WilSon")</code>的执行效果不同。</p>
      <p>在游戏资源中，大部分材质名为纯小写，少数材质名为大小写混用，如<code>Pig_King</code>。</p>
    </>
  ),
  // example: (
  //   <>
  //     梨子梨子梨子
  //   </>
  // )
}

API_DOC["SetSkin"] = {
  title: "设置皮肤",
  desc: (
    <>
      <p>和<code>SetBuild</code>的功能一致。</p>
    </>
  )
}

API_DOC["PlayAnimation"] = {
  title: "播放动画",
  desc: (
    <>
      <p>设置动画（Animation）的名字。</p>
      <p>动画决定了物体的变化过程，必须同时指定动画库和动画的名字，才会生效。</p>
      <p>动画是唯一的，{OVERRIDE_HINT}。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>动画名对大小写敏感。</p>
      <p>在游戏中，<code>PlayAnimation</code>还有第二个可选参数，代表动画是否循环播放（默认为不循环）。
      不循环的动画在播放完毕时会触发<code>animover</code>事件。</p>
    </>
  )
}

API_DOC["PushAnimation"] = {
  title: "推送动画",
  desc: (
    <>
      <p>向动画队列末端添加一个新的动画。</p>
      <p>在动画渲染器中，该指令的效果和<code>PlayAnimation</code>一致。</p>
      <p></p>
    </>
  ),
  desc_detail: (
    <>
      <p>动画名对大小写敏感。</p>
      <p>在游戏中，<code>PushAnimation</code>还有第二个可选参数，代表动画是否循环播放（默认为循环）。
      若指定为不循环，则添加队列的操作可重复执行。动画队列中的所有动画播放完毕后，
      触发<code>animqueueover</code>事件。</p>
      <p>执行<code>PlayAnimation</code>会清空动画队列。</p>
    </>
  )
}

API_DOC["AddOverrideBuild"] = {
  title: "添加覆盖材质",
  desc: (
    <>
      <p>将另一个材质的所有符号覆盖在当前动画上。</p>
    </>
  ),
  desc_detail: (
    <> 
      <p>该指令和<code>OverrideSymbol</code>的底层原理一致，且覆盖效果会被
      <code>ClearOverrideSymbol</code>清除。</p>
      <p>以材质“sparks”为例，该材质包含了“sprk_1”、“sprk_2”两个符号，
        所以调用<code>AddOverrideBuild("sparks")</code>等价于同时调用了
        <code>OverrideSymbol("sprk_1", "sparks", "sprk_1")</code>和
        <code>OverrideSymbol("sprk_2", "sparks", "sprk_2")</code>。
      </p>
    </>
  )
}

API_DOC["ClearOverrideBuild"] = {
  title: "清除覆盖材质",
  desc: (
    <>
      <p>清除当前动画在另一个材质中存在的所有符号的覆盖操作。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>该指令一般用于<code>AddOverrideBuild</code>的逆向操作，但同时也会清除
      <code>OverrideSymbol</code>的覆盖效果。</p>
      <p>以材质“sparks”为例，该材质包含了“sprk_1”、“sprk_2”两个符号，
        所以调用<code>ClearOverrideBuild("sparks")</code>等价于同时调用了
        <code>ClearOverrideSymbol("sprk_1", "sparks", "sprk_1")</code>和
        <code>ClearOverrideSymbol("sprk_2", "sparks", "sprk_2")</code>。
      </p>
    </>
  ),
}

API_DOC["SetBankAndPlayAnimation"] = {
  title: "设置动画库和动画",
  desc: (
    <>
      <p>同时设置动画库（Bank）和动画（Animation）的名字，
        是<code>SetBank</code>和<code>PlayAnimation</code>两个指令的集合。</p>
    </>
  )
}

API_DOC["OverrideSymbol"] = {
  title: "覆盖符号",
  desc: (
    <>
      <p>使用某个材质的符号（Symbol）对当前动画符号进行替换，</p>
      <p>第一个参数是被替换的符号名，第二和第三个参数分别是用于替换的材质名和符号名。</p>
      <p>多次调用该指令时，若第一个参数不同，替换效果会同时存在，否则会发生覆盖。</p>
      <p>在游戏中，该指令通常用于对动画的局部替换，如武器、帽子、护甲、背包的材质替换。</p>
    </>
  )
}

API_DOC["OverrideSkinSymbol"] = {
  title: "覆盖皮肤符号",
  desc: (
    <>
      <p>覆盖符号，但使用皮肤材质，和<code>OverrideSymbol</code>的功能一致。</p>
    </>
  ),
}

API_DOC["ClearOverrideSymbol"] = {
  title: "清除覆盖符号",
  desc: (
    <>
      <p>恢复某个已被覆盖的符号（Symbol），是<code>OverrideSymbol</code>的逆向指令。</p>
    </>
  )
}

API_DOC["Hide"] = {
  title: "隐藏图层",
  desc: (
    <>
      <p>隐藏一个动画图层（Layer）。</p>
      <p>注意：图层定义在动画中，符号定义在材质中。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>图层名的数据类型是哈希（<SmallHashTypeHint/>），对大小写不敏感，
        因此，<code>Hide("ARM_carry")</code>和<code>Hide("arm_carry")</code>的执行效果完全一致。
      </p>
    </>
  ),
}

API_DOC["Show"] = {
  title: "显示图层",
  desc: (
    <>
      <p>显示一个动画图层（Layer）。</p>
      <p><code>Hide</code>的逆向指令。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>图层名的数据类型是哈希（<SmallHashTypeHint/>），对大小写不敏感，
        因此，<code>Show("ARM_carry")</code>和<code>Show("arm_carry")</code>的执行效果完全一致。
      </p>
    </>
  ),
}

API_DOC["HideSymbol"] = {
  title: "隐藏符号",
  desc: (
    <>
      <p>隐藏一个材质符号（Symbol）。</p>
      <p>注意：图层定义在动画中，符号定义在材质中。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>符号名的数据类型是哈希（<SmallHashTypeHint/>），对大小写不敏感，
        因此，<code>HideSymbol("swap_object")</code>和<code>HideSymbol("SWAP_OBJECT")</code>的执行效果完全一致。
      </p>
    </>
  ),
}

API_DOC["ShowSymbol"] = {
  title: "显示符号",
  desc: (
    <>
      <p>显示一个材质符号（Symbol）。</p>
      <p><code>HideSymbol</code>的逆向指令。</p>
    </>
  ),
  desc_detail: (
    <>
      <p>符号名的数据类型是哈希（<SmallHashTypeHint/>），对大小写不敏感，
        因此，<code>ShowSymbol("swap_object")</code>和<code>ShowSymbol("SWAP_OBJECT")</code>的执行效果完全一致。
      </p>
    </>
  ),
}

API_DOC["SetAddColour"] = {
  title: "设置颜色加法",
  desc: (
    <>
      <p>对动画整体着色。</p>
      <p>颜色加法数值是唯一的，{OVERRIDE_HINT}。</p>
    </>
  )
}

API_DOC["SetSymbolAddColour"] = {
  title: "设置符号颜色加法",
  desc: (
    <>
      <p>对一个材质符号进行单独着色。</p>
      <p>该指令可多次执行，若符号名不一致，着色效果会同时存在；若符号名一致，则会发生覆盖，只有最后的指令生效。</p>
    </>
  )
}

API_DOC["SetMultColour"] = {
  title: "设置颜色乘法",
  desc: (
    <>
      <p>对动画整体着色。</p>
      <p>颜色乘法数值是唯一的，{OVERRIDE_HINT}。</p>
    </>
  )
}

API_DOC["SetSymbolMultColour"] = {
  title: "设置符号颜色乘法",
  desc: (
    <>
      <p>对一个材质符号进行单独着色。</p>
      <p>该指令可多次执行，若符号名不一致，着色效果会同时存在；若符号名一致，则会发生覆盖，只有最后的指令生效。</p>
    </>
  )
}

const ANIM_CONTROL_HINT = "该指令在动画渲染器中没有任何效果，请直接用下方的控制面板进行相关操作。"

API_DOC["Pause"] = {
  title: "暂停",
  desc: (
    <>
      <p>冻结当前的动画播放进度。</p>
      <p>执行后，使用<code>Resume</code>指令可恢复动画播放。</p>
      <p>{ANIM_CONTROL_HINT}</p>
    </>
  )
}

API_DOC["Resume"] = {
  title: "继续",
  desc: (
    <>
      <p>重新开始播放动画。<code>Pause</code>的逆向指令。</p>
      <p>{ANIM_CONTROL_HINT}</p>
    </>
  )
}

API_DOC["SetPercent"] = {
  title: "设置百分比",
  desc: (
    <>
      <p>将动画进度冻结在某个位置，参数范围0–1。</p>
      <p>{ANIM_CONTROL_HINT}</p>
    </>
  ),
  desc_detail: (
    <>
      <p>在游戏中，该指令通常用于和数值有关的UI控件动画，如饥饿、理智、生命和潮湿度的标志。</p>
    </>
  ),
}

API_DOC["SetDeltaTimeMultiplier"] = {
  title: "设置播放速度",
  desc: (
    <>
      <p>设置动画播放的快慢，默认值为1（原速播放），数值越大播放速度越快。</p>
      <p>{ANIM_CONTROL_HINT}</p>
    </>
  )
}

function InlineApi(props: {name: string}) {
  return (
    <Tag minimal style={{
      margin: "0 4px"
    }}>{props.name}</Tag>
  )
}

function SmallHashTypeHint() {
  return (
    <Popover2 content={<div style={{width: 400, padding: 10}} className="bp4-running-text">
      <p>smallhash（小写哈希）是饥荒对字符串的一种转换手段，其先将字符串转换为小写，
      然后逐字节运算，最终得到一个4字节整数。因为计算前进行过小写转换，所以结果不受原始字符大小写的影响。</p>

      <p>在饥荒中，以下函数参数的数据类型为哈希：</p>
      <ul>
        <li>动画库 - AnimState:SetBank(<b>BANK</b>)</li>
        <li>标签 - inst:AddTag(<b>TAG</b>) / inst:RemoveTag(<b>TAG</b>)</li>
        <li>图层 - AnimState:Hide(<b>LAYER</b>)</li>
        <li>符号 - AnimState:OverrideSymbol(<b>SYMBOL</b>, BUILD, <b>SYMBOL</b>)</li>
        （其中，第一个和第三个参数是哈希，对大小写不敏感；第二个参数是字符串，对大小写敏感。）
      </ul>
      
      <p>示例：</p>
      <Code language="lua" src={
`local inst = CreateEntity()
inst:AddTag("FX")
print(inst:HasTag("fx")) -- true
inst:RemoveTag("fx")
print(inst:HasTag("FX")) -- false
print(inst:HasTag("fx")) -- false`}>
      </Code>
      </div>}>
      {/* <Button minimal small icon="info-sign" style={{marginLeft: 4}}/> */}
      <a>smallhash</a>
    </Popover2>
  )
}