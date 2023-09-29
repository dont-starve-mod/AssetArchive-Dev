import { Icon } from '@blueprintjs/core'
import React from 'react'

export default function HomePage() {
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
                    <Icon icon="key-command"/>
                    <span style={{fontSize: "150%"}}>P</span>
                  </kbd>
                </span>
              </td>
            </tr>
            <tr>
              {/* <td>第二行</td>
              <td>233</td> */}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
