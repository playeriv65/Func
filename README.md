# Magic Func

🪄 基于 Goose Agent 的魔法函数应用 - 让 AI 自动安装工具并执行任务

## 架构说明

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   前端网页      │ ──────> │  Flask Gateway   │ ──────> │ Docker Sandbox  │
│ (文件拖放 + 指令)│         │    (API 包装)     │         │   (Goose Agent) │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                                        │
                                                        ▼
                                                 ┌─────────────────┐
                                                 │  /workspace     │
                                                 │  ├── input/     │
                                                 │  └── output/    │
                                                 └─────────────────┘
```

## 核心特性

- **🔧 自动化工具安装**: Agent 可以使用 `apt-get`、`npx` 等命令自行安装所需工具
- **📦 状态持久化**: Goose 的会话状态和配置保存在 Docker volume 中，越用越智能
- **📁 文件交换**: 通过共享 workspace 目录进行文件输入输出，不走网络
- **🚀 简单部署**: 一条命令启动所有服务

## 快速开始

### 1. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env  # 如果没有 .env 文件，使用已有的

# 编辑 .env 文件，配置你的 API 密钥
```

### 2. 启动服务

```bash
# 构建并启动所有容器
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 访问前端

打开浏览器访问：http://localhost:8000

### 4. 使用流程

1. **上传文件**: 拖拽文件到输入区域，或点击上传
2. **输入指令**: 用自然语言描述任务，例如：
   - "把 input 目录的文档转换成 PDF 格式"
   - "分析 data.csv 并生成统计报告"
   - "提取图片中的文字内容"
3. **执行任务**: 点击执行按钮，等待完成
4. **下载结果**: 从输出区域下载生成的文件

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | LLM API 密钥 | (必填) |
| `OPENAI_HOST` | API 基础 URL（不带 /v1） | https://api.openai.com |
| `GOOSE_MODEL` | 模型名称 | gpt-4o |
| `PORT` | Gateway 服务端口 | 8000 |
| `GOOSE_TIMEOUT` | 任务超时时间 (秒) | 300 |

## 目录结构

```
.
├── Dockerfile              # Sandbox 容器镜像
├── docker-compose.yml      # Docker Compose 配置
├── goose-recipe.yaml       # Goose Agent 系统提示词配置（唯一注入字段：system_prompt）
├── gateway/
│   ├── app.py             # Flask API 主程序
│   ├── Dockerfile         # Gateway 容器镜像
│   ├── requirements.txt   # Python 依赖
│   └── static/
│       └── index.html     # 前端页面
└── workspace/
    ├── input/             # 输入文件目录
    ├── output/            # 输出文件目录
    └── tmp/               # 临时文件目录（任务完成后清理）
```

## API 接口

### POST /api/execute

执行任务

```json
{
  "instruction": "自然语言指令"
}
```

### GET /api/task/:task_id

获取任务状态

### POST /api/files/upload

上传文件

### GET /api/files/output

列出输出文件

### GET /api/files/download/:filename

下载输出文件

## 开发说明

### Goose Agent 能力

容器内的 Goose Agent 拥有：

- **root 权限**: 可以执行任何系统命令
- **完整 apt**: 可以安装系统软件包
- **Node.js + npx**: 可以安装 MCP 工具和 npm 包
- **文件访问**: 完全访问 /workspace 目录

### 添加新功能

1. 修改 `gateway/app.py` 添加 API 端点
2. 更新 `gateway/static/index.html` 添加前端交互
3. 重新构建：`docker-compose up -d --build`

## 常见问题

### Q: 如何查看 Agent 的执行日志？

```bash
docker logs magic-func-sandbox
```

### Q: 如何重置 Agent 状态？

```bash
docker-compose down -v  # 删除所有 volume
docker-compose up -d --build
```

### Q: 任务超时怎么办？

增加 `GOOSE_TIMEOUT` 环境变量，默认 300 秒（5 分钟）

## License

MIT
