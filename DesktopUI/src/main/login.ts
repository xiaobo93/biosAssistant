import { BrowserWindow, ipcMain } from 'electron'
const MAIN_WINDOW = { width: 900, height: 670 }
export function loginModule(){
    ipcMain.handle('login', (event, username: string, password: string) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return
        // win.setResizable(true)
        // win.setMinimumSize(400, 300)
        // win.setMaximumSize(0, 0)
        // win.setSize(MAIN_WINDOW.width, MAIN_WINDOW.height)
        // win.center()
        console.log(username, password)
        return true
    })
}
