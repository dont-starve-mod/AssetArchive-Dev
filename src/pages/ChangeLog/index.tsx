import { H5, UL } from '@blueprintjs/core'
import { WebviewWindow } from '@tauri-apps/api/window'

function Img(props: {src: string}) {
  return (
    <div className="max-w-lg">
      <img src={props.src} className="max-w-full mt-2 mb-2"></img>
    </div>
  )
}

export default function ChangeLog() {
  return (
    <div className="p-5 bp4-running-text overflow-scroll" style={{maxHeight: "100vh"}}>
      <H5>beta - 0.1.4</H5>
      <UL>
        <li>修复切换音频输出后，声音播放错误的问题。</li>
        <li>修复部分贴图（如尾巴）的渲染错误。</li>
        <li>新增模组工具。</li>
      </UL>
      <H5>beta - 0.1.3</H5>
      <UL>
        <li>修复软件更新提示。</li>
        <li>修复安装在中文路径下无法启动的问题。</li>
        <li>修复无任何信息的白屏问题。</li>
        <li>修复软件在多开情况下的报错：Meilisearch process exited。</li>
      </UL>
      <H5>beta - 0.1.2</H5>
      <UL>
        <li>【MacOS】修复在老版本Mac系统中的运行错误。</li>
      </UL>
      <H5>beta - 0.1.1</H5>
      <UL>
        <li>修复加载音效引起的报错。</li>
      </UL>
      <H5>beta - 0.1.0</H5>
      <UL>
        <li>添加反馈链接。</li>
      </UL>
      {/* <H5>alpha - 0.0.7</H5>
      <UL>
        <li>动画渲染器的配置项目和导出参数可保存。</li>
        <li>修复部分情况下搜索功能异常的问题。</li>
      </UL>
      <H5>alpha - 0.0.6</H5>
      <UL>
        <li>修复最小化、最大化和关闭按钮无法点击的问题。</li>
        <li>修复音效无法搜索的问题。</li>
        <li>新增特效预览和动态壁纸预览。</li>
        <Img src={v006}/>
      </UL>
      <H5>alpha - 0.0.5</H5>
      <UL>
        <li>修复加载包含非法animation/build/hash字符串的资源时引起的报错。</li>
        <li>修复暂停状态下动画无法被移动和缩放的bug。</li>
        <li>新增动画预设中的人物模型选项。</li>
        <Img src={v005}/>
      </UL> */}
    </div>
  )
}

export function openChangeLog() {
  let label = "change-log"
  let subwindow = WebviewWindow.getByLabel(label)
  if (subwindow)
    subwindow.setFocus().then(console.log, console.error)
  else
    new WebviewWindow(label, {
      title: "",
      url: "/change-log",
      width: 600,
      height: 800,
      minWidth: 320,
      minHeight: 440,
      resizable: true,
    })
}