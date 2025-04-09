import { writeText as write } from '@tauri-apps/plugin-clipboard-manager'

export async function writeText(text: string) {
  await write(text)
}