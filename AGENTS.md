# Magic Func 开发规范

## Goose 配置

使用 OpenAI 兼容 API 时，只需配置三个环境变量：

```bash
OPENAI_API_KEY=your-api-key
OPENAI_HOST=https://api.openai.com  # 不带 /v1，Goose 自动拼接
GOOSE_MODEL=gpt-4o
```

### 注意事项

- `OPENAI_HOST` 不要带 `/v1` 后缀，Goose 会自动拼接 `/v1/chat/completions`
- 不要设置 `GOOSE_TOOLSHIM=true`，除非本地有 Ollama 服务
- `GOOSE_DISABLE_SESSION_NAMING=true` 可避免生成会话标题时的额外 API 调用

## Goose Recipe 配置

Magic Func 使用 `goose-recipe.yaml` 文件定义 Agent 的系统提示词和工作环境。

### 文件结构

```yaml
# goose-recipe.yaml
system_prompt: |
  # Magic Func - 魔法函数执行器
  
  ## 工作环境
  - 工作目录：/workspace
  - 输入目录：/workspace/input
  - 输出目录：/workspace/output
```

### 输入输出约定

- **输入**: 用户将文件放入 `./workspace/input/`
- **输出**: Agent 将结果保存到 `./workspace/output/`
- **不要修改**: input 目录的原始文件

### 修改系统提示词

直接编辑 `goose-recipe.yaml` 的 `system_prompt` 字段。

详细说明见 `GOOSE_RECIPE.md`。

## 常见问题

### 404 错误

如果 API 直接调用成功但 Goose 报 404，检查：
1. `GOOSE_TOOLSHIM` 是否为 true（需要本地 Ollama）
2. `OPENAI_HOST` 格式是否正确

### 连接 localhost:11434 失败

`GOOSE_TOOLSHIM=true` 会让 Goose 连接本地 Ollama 来解析工具调用。如果没有 Ollama，必须禁用此选项。

### 系统提示词未加载

检查 gateway 容器日志：

```bash
docker logs magic-func-gateway | grep "Successfully loaded"
```

确保 `goose-recipe.yaml` 文件存在并正确挂载到 `/workspace/goose-recipe.yaml`。
---

## UI 开发规范

### 简洁模式（默认）

- 居中显示指令输入框
- 任务完成显示 Toast 通知
- 隐藏 agent 执行过程

### 复杂模式（调试用）

- 通过右上角开关切换
- 显示完整聊天记录和 agent 输出
- 支持折叠工具调用组件

### Toast 通知样式

- **成功**: 绿色背景 (`--success-bg`) + 绿色边框
- **错误**: 红色背景 (`--error-bg`) + 红色边框
- **位置**: 顶部中央，3 秒自动消失
- **文字**: 使用 `var(--text-primary)` 确保主题兼容

### 模式切换 CSS 规范

使用类选择器控制显示/隐藏，避免内联样式：

```css
/* 简洁模式 */
.chat-panel:not(.complex-mode) .instruction-panel { display: flex; }
.chat-panel:not(.complex-mode) .chat-messages { display: none; }

/* 复杂模式 */
.chat-panel.complex-mode .instruction-panel { display: none; }
.chat-panel.complex-mode .chat-messages { display: flex; }
```
