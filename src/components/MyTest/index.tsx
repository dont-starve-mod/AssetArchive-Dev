import { Button } from '@blueprintjs/core'
import React from 'react'
import { invoke } from '@tauri-apps/api'

export default function MyTest() {
  return (
    <div>
      <Button onClick={()=> invoke("fmod_send_message", {data: 
        JSON.stringify({
          api: "LoadGameAssets",
          args: ["/Users/wzh/Library/Application Support/Steam/steamapps/common/Don't Starve Together/dontstarve_steam.app/Contents/data/sound"],
        })}).then(console.log)}>
        fmod_send_message
      </Button>
      <Button onClick={()=> invoke("fmod_update", {}).then(console.log)}>
        fmod_update
      </Button>
      <Button onClick={()=> invoke("fmod_get_data", { only_dirty: true }).then(console.log)}>
        fmod_get_data
      </Button>
    </div>
  )
}
