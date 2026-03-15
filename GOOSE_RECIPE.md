# Goose Recipe 配置说明

## 文件位置

- **Recipe 文件**: `goose-recipe.yaml` (项目根目录)
- **唯一字段**: `system_prompt` - 直接传递给 `goose run --system` 参数

## 输入输出路径

Goose Agent 在 Magic Func 项目中的工作路径：

| 路径 | 用途 |
|------|------|
| `/workspace` | 工作根目录 |
| `/workspace/input` | **输入目录** - 用户上传的文件放在这里 |
| `/workspace/output` | **输出目录** - Agent 处理结果保存在这里 |
| `/workspace/tmp` | **临时目录** - 中间文件暂存，任务完成后清理 |

## Agent 角色

Goose Agent 在 Magic Func 中扮演**魔法函数执行器**的角色：

1. **自动安装工具** - 根据任务需要自行安装 `apt-get`、`npm`、`pip` 等工具
2. **读取输入** - 从 `/workspace/input` 目录读取用户提供的文件
3. **处理文件** - 执行用户指令，处理输入文件
4. **保存结果** - 将处理结果保存到 `/workspace/output` 目录

## 配置文件结构

`goose-recipe.yaml` 只包含一个字段：

```yaml
system_prompt: |
  # Magic Func - 魔法函数执行器
  
  你是一个运行在 Docker 容器中的魔法函数执行器...
```

其他所有元数据（title, description, workspace, behavior 等）都已删除，只保留实际注入的 `system_prompt`。

## 工作流程

```
1. 理解用户指令
2. 检查 input 目录
3. 安装所需工具
4. 处理文件
5. 保存结果到 output
6. 清理 tmp 目录
7. 向用户报告
```

## 修改系统提示词

直接编辑 `goose-recipe.yaml` 文件中的 `system_prompt` 字段。

## 配置文件挂载

Docker Compose 自动将 `goose-recipe.yaml` 挂载到两个容器：

- **magic-sandbox**: `/workspace/goose-recipe.yaml` (供 Agent 参考)
- **gateway**: `/workspace/goose-recipe.yaml` (供 gateway 读取并传递给 Goose)

gateway 的 `app.py` 会从这个文件读取 `system_prompt` 字段，并在执行 `goose run` 时通过 `--system` 参数注入。
