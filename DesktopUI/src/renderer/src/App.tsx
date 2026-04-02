import { useEffect, useState } from 'react'
import Versions from './components/Versions'
import Login from './components/Login'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  useEffect(() => {
    document.body.classList.remove('login-mode', 'main-mode')
    document.body.classList.add(isAuthenticated ? 'main-mode' : 'login-mode')
  }, [isAuthenticated])

  const handleLoginSuccess = (LoginState:boolean): void => {
    setIsAuthenticated(LoginState)
    return 
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }
  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <Versions></Versions>
    </>
  )
}

export default App
