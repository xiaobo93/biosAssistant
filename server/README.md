# biosAssistant Server

这是 `biosAssistant` 仓库下的 **Node + TypeScript** 子工程（使用 `pnpm`）。

## 环境要求
- Node.js（建议 18+ / 20+）
- pnpm

## 快速开始
在 `server/` 目录下执行：

```bash
pnpm install
pnpm dev
```

你会进入一个 CLI 交互窗口（输入 `exit` 退出）。

## 构建与启动

```bash
pnpm build
pnpm start
```

## 脚本说明
- **dev**：使用 `tsx watch` 直接运行 `src/cli.ts`（开发模式热重载）
- **build**：使用 `tsc` 编译到 `dist/`
- **start**：运行编译后的 `dist/cli.js`

## 环境变量
- **OPENAI_API_KEY**：必需
- **OPENAI_BASE_URL**：可选；未设置时使用官方默认地址。用于兼容网关、代理或自建端点（不要末尾多余 `/`）
- **OPENAI_MODEL**：可选（默认 `gpt-4.1-mini`）

## 目录结构
- `src/cli.ts`：CLI 入口
- `src/config.ts`：配置（读取环境变量）
- `src/agent/`：agent 模块目录（示例实现位于 `src/agent/index.ts`）
