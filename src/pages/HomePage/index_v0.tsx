import { Button, Icon } from '@blueprintjs/core'
import React, { useEffect } from 'react'
import { useAppSetting, useOS } from '../../hooks'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const {isMacOS} = useOS()
  const [root] = useAppSetting("last_dst_root")
  const navigate = useNavigate()

  // useEffect(()=> {
  //   let timer = setTimeout(()=> {
  //     if (!root) navigate("/welcome")
  //   }, 1000)
  //   return ()=> clearTimeout(timer)
  // }, [root])

  return (
    <div>
      <div style={{
        width: 300, height: 200, 
        color: "#aaa", 
        // backgroundColor: "pink", 
        margin: "200px auto",
        fontWeight: 600,
        fontSize: "125%",
        textAlign: "center",
      }}>
        <table style={{width: "100%"}}>
          <tbody>
            <tr>
              <td>搜索资源</td>
              <td>
                <span className='bp4-key-combo'>
                  <kbd className='bp4-key'>
                    {
                      isMacOS && <Icon icon="key-command"/>
                    }
                    {
                      !isMacOS && <Icon icon="key-control"/>
                    }
                    <span style={{fontSize: "150%"}}>P</span>
                  </kbd>
                </span>
              </td>
            </tr>
            <tr style={{display: "none"}}>
              <td>任意门</td>
              <td>
                <Button small icon="blank"></Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
