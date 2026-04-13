/**
 * @filename login.ts
 * @author xiaobo
 * @date 2026-04-02
 * @description 
 *  login 模块，负责处理登录相关的 IPC 通信和窗口调整逻辑
 *  监听 'login' IPC 消息，验证用户名和密码，并根据验证结果调整窗口大小和状态
 *  成功登录后，窗口将变为可调整大小，并设置最小尺寸和最大尺寸，同时居中显示
 *  登录失败时，返回 false 给渲染进程，提示用户账号或密码错误
 */
import { BrowserWindow, ipcMain } from 'electron'
const MAIN_WINDOW = { width: 900, height: 670 }
const AUTH_USERNAME = '123'
const AUTH_PASSWORD = '123'

export function loginModule(): void {
  ipcMain.handle('login', (event, username: string, password: string) => {
    console.log('Received login request:', username, password)
    if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
      console.log('Login failed: Invalid credentials')
      return false
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.setResizable(true)
    win.setMinimumSize(400, 300)
    win.setMaximumSize(0, 0)
    win.setSize(MAIN_WINDOW.width, MAIN_WINDOW.height)
    win.center()
    return true
  })
}
