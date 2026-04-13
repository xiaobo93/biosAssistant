import { type FormEvent, useState } from 'react'
import '../assets/login.css'

export default function Login(): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const result = await window.login.verifyAccount(username, password)
    if (!result) {
      alert('账号或密码错误')
    } else {
      alert('登录成功')
    }
  }

  return (
    <div className="login">
      <h1 className="login-title">Bios Assistant</h1>
      <p className="login-subtitle">请登录以继续</p>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label className="login-field">
          <span className="login-label">账号</span>
          <input
            className="login-input"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="login-field">
          <span className="login-label">密码</span>
          <input
            className="login-input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="login-submit" type="submit">
          登录
        </button>
      </form>
    </div>
  )
}
