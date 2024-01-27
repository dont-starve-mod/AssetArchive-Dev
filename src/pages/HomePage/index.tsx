import { Button, Icon } from '@blueprintjs/core'
import React from 'react'
import { useOS } from '../../hooks'

export default function HomePage() {
  const {isMacOS} = useOS()
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
