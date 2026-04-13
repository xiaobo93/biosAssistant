import { contextBridge, ipcRenderer } from 'electron'

export function loginModule(): void {
  contextBridge.exposeInMainWorld('login', {
    verifyAccount: (username: string, password: string) =>
      ipcRenderer.invoke('login', username, password)
  })
}
