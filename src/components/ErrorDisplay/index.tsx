import { writeText } from '@tauri-apps/api/clipboard'
import { FallbackProps } from 'react-error-boundary'

export default function ErrorDisplay(props: FallbackProps) {
  const {error} = props
  const copy = ()=> {
    writeText(`${error.message}\n${window.location.href}`).then(()=> 
      window.alert("已将错误信息拷贝到剪贴板")
    )
  }
  return (
    <div className="p-6 mt-2 text-lg">
      <p>发生错误:</p>
      <pre className="text-red-500">{error.message}</pre>
      <pre>{window.location.href}</pre>
      <hr/>
      <p>如果反复出现该问题，可以找作者反馈。</p>
      <a onClick={copy}>复制错误信息</a>
      <a onClick={()=> window.location.href = "/"} className="ml-6">重启软件</a>
    </div>
  )
}