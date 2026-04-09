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

你应该能看到输出：`agent k`

## 构建与启动

```bash
pnpm build
pnpm start
```

## 脚本说明
- **dev**：使用 `tsx watch` 直接运行 `src/index.ts`（开发模式热重载）
- **build**：使用 `tsc` 编译到 `dist/`
- **start**：运行编译后的 `dist/index.js`

## 目录结构
- `src/index.ts`：应用入口
- `src/agent/`：agent 模块目录（示例实现位于 `src/agent/index.ts`）
