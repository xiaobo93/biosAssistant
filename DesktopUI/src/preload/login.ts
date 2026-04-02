import {contextBridge,ipcRenderer} from 'electron'


export function loginModule(){
    contextBridge.exposeInMainWorld('login', {
        verifyAccount: (username: string, password: string) => ipcRenderer.invoke('login', username, password)
      })
}
