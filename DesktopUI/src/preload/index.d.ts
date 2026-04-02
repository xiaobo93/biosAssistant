import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    login: {
      verifyAccount: (username: string, password: string) => Promise<boolean>
    }
  }
}
