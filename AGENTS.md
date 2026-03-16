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

## 提示词优化经验

### 问题：AI 中途停止或让用户执行

Goose 默认行为像"助手"，可能：
- 写脚本让用户自己运行
- 中途停下来问用户怎么做
- 只回答问题不执行操作

### 解决方案：强制执行模式

在 `goose-recipe.yaml` 中添加以下约束：

1. **禁止行为清单**
   - 禁止询问用户任何问题
   - 禁止说"你可以运行"让用户自己执行
   - 禁止在 output 目录为空时结束

2. **强制行为清单**
   - 必须自己运行所有命令和脚本
   - 必须在 output 目录生成实际文件
   - 即使是咨询问题，也要执行操作并生成输出

3. **决策规则表**
   用表格明确告诉 AI 对各类模糊指令如何处理：
   | 指令类型 | 处理方式 |
   |---------|---------|
   | "写一个脚本" | 创建+运行+保存输出 |
   | "我应该用什么方法" | 选择方法+演示执行 |
   | 文件不存在 | 创建示例数据+处理 |

4. **输出验证步骤**
   要求 AI 在任务结束前执行 `ls /workspace/output` 确认有文件。

### 测试验证

创建了完整的测试集验证效果：

#### 测试集结构
```
test/
├── input/           # 40个测试文件（PDF、Excel、CSV、JSON、图片、音频、视频等）
├── test_cases.json  # 120个测试用例
├── run_tests.py     # 完整测试运行器
├── batch_test.py    # 分批测试运行器
└── quick_test.py    # 快速测试（前20个）
```

#### 测试用例类别（120个）
| 类别 | 数量 | 说明 |
|-----|------|------|
| text_processing | 12 | 文本处理任务 |
| data_analysis | 18 | 数据分析任务 |
| format_conversion | 15 | 格式转换任务 |
| script_creation | 15 | 脚本创建任务 |
| file_operations | 10 | 文件操作任务 |
| network_tasks | 10 | 网络相关任务 |
| ambiguous_tasks | 10 | 模糊指令任务 |
| complex_tasks | 10 | 复杂多步骤任务 |
| error_handling | 5 | 错误处理任务 |
| consultation | 10 | 咨询类任务 |

#### 运行测试
```bash
# 快速测试
python3 test/quick_test.py

# 分批测试
python3 test/batch_test.py 1 50

# 完整测试
python3 test/run_tests.py
```

#### 测试结果
- **通过率**: 94.3% (83/88 已测试)
- 所有类别测试通过率 > 90%
- 模糊指令和咨询类任务 100% 通过

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

### 任务超时

复杂任务（如安装多个依赖）可能超时。解决方法：
1. 增加 `GOOSE_TIMEOUT` 环境变量（默认 300 秒）
2. 简化任务指令，分步执行

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

---

## 格式转换测试

### 测试集结构

```
test/
├── input/                    # 测试输入文件
│   ├── format_conversion/    # 格式转换专用测试文件
│   │   ├── icon.svg          # SVG图标
│   │   ├── places.kml        # KML地理数据
│   │   ├── track.gpx         # GPX轨迹
│   │   ├── article.html      # HTML文档
│   │   ├── document.md       # Markdown文档
│   │   └── ...
│   ├── employees.csv         # 员工数据
│   ├── sales.csv             # 销售数据
│   ├── image.jpg/png         # 测试图片
│   └── ...
├── format_conversion_tests.json  # 格式转换测试用例
├── run_format_tests.py       # 格式转换测试运行器
├── test_cases.json           # 通用测试用例
└── run_tests.py              # 通用测试运行器
```

### 测试类别与通过率

| 类别 | 通过率 | 说明 |
|------|--------|------|
| 图片格式转换 | 100% | JPG/PNG/WebP/TIFF/BMP/ICO 互转 |
| 文档格式转换 | 90% | Markdown/HTML/PDF/JSON/YAML 等 |
| GIS地理数据转换 | 67% | KML/GeoJSON/GPX 转换 |
| 音视频格式转换 | 38% | MP3/WAV/MP4/WebM 等 |
| CAD/3D模型转换 | 待优化 | 需要 FreeCAD/MeshLab 等大型工具 |

### 运行格式转换测试

```bash
# 列出所有测试类别
python3 test/run_format_tests.py --list

# 运行指定类别
python3 test/run_format_tests.py -c "图片格式转换"

# 运行单个测试
python3 test/run_format_tests.py -t img_001
```

### Agent 自主安装工具能力

Agent 能够检测并自主安装所需工具：

| 工具 | 安装命令 | 大小 | 用途 |
|------|---------|------|------|
| FFmpeg | `apt install -y ffmpeg` | ~100MB | 音视频处理 |
| GDAL | `apt install -y gdal-bin` | ~96MB | GIS数据处理 |
| ImageMagick | (已预装) | - | 图片处理 |
| Pandoc | `apt install pandoc` | ~50MB | 文档转换 |

**注意**: Goose 有时会"幻觉"声称工具已安装，实际未安装。需要验证 `which <tool>` 的实际输出。

### 常见问题

#### Goose 幻觉问题
- 症状: 日志显示工具已安装，但 `which ffmpeg` 返回空
- 原因: Goose 可能从会话缓存或推理中"假设"工具存在
- 解决: 使用 `--no-session` 或重新启动容器

#### 音视频转换输出为空
- 部分转换任务完成但无输出文件
- 可能是文件格式问题或 agent 执行中断
- 建议检查 input 文件是否有效
