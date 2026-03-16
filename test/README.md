# Goose Agent 测试集

## 概述

本测试集用于验证 Goose Agent 的执行能力，确保其能够完整执行任务而非中途停止或让用户执行。

## 测试文件

`input/` 目录包含 40 个各种格式的测试文件：

| 文件类型 | 示例文件 | 数量 |
|---------|---------|------|
| 文本文件 | text_chinese.txt, text_english.txt | 5 |
| CSV 数据 | employees.csv, sales.csv, grades.csv | 8 |
| JSON 数据 | config.json, products.json, nested.json | 5 |
| XML 数据 | books.xml, data.xml | 2 |
| YAML 配置 | settings.yaml | 1 |
| Markdown | README.md | 1 |
| HTML | webpage.html | 1 |
| 代码文件 | script.py, app.js, deploy.sh | 4 |
| SQL | queries.sql | 1 |
| 配置文件 | config.ini, pyproject.toml, .env.example | 3 |
| 日志文件 | app.log | 1 |
| 图片 | image.jpg, image.png | 2 |
| 音频 | audio.mp3 | 1 |
| 视频 | video.mp4 | 1 |
| PDF | sample.pdf | 1 |
| Excel | sample.xlsx | 1 |
| 其他 | urls.txt, ips.txt, addresses.csv 等 | 4 |

## 测试用例

`test_cases.json` 包含 120 个测试用例，分为 10 个类别：

1. **text_processing** (12个): 文本处理任务
2. **data_analysis** (18个): 数据分析任务
3. **format_conversion** (15个): 格式转换任务
4. **script_creation** (15个): 脚本创建任务
5. **file_operations** (10个): 文件操作任务
6. **network_tasks** (10个): 网络相关任务
7. **ambiguous_tasks** (10个): 模糊指令任务
8. **complex_tasks** (10个): 复杂多步骤任务
9. **error_handling** (5个): 错误处理任务
10. **consultation** (10个): 咨询类任务

## 使用方法

### 快速测试（前20个）
```bash
python3 test/quick_test.py
```

### 分批测试
```bash
# 测试指定范围
python3 test/batch_test.py 1 20    # 测试1-20
python3 test/batch_test.py 31 50   # 测试31-50
```

### 完整测试
```bash
python3 test/run_tests.py
```

## 测试结果

最新测试结果：

| 批次 | 通过率 |
|-----|-------|
| 1-20 | 90% (18/20) |
| 31-50 | 95% (19/20) |
| 51-70 | 90% (18/20) |
| 71-84 | 100% (14/14) |
| 85-90 | 100% (6/6) |
| 101-108 | 100% (8/8) |
| **总计** | **94.3% (83/88)** |

## 通过标准

- ✅ **通过**: 输出目录有文件，无问题关键词
- ❌ **失败**: 输出目录为空，或检测到助手行为

## 问题关键词检测

测试会检测以下问题行为：
- "should I", "do you want" - 询问用户
- "you can run" - 让用户自己执行
- "你想", "你可以运行" - 中文版本

## 提示词优化要点

确保 `goose-recipe.yaml` 包含：

1. **禁止行为清单** - 明确禁止询问用户
2. **决策规则表** - 为模糊指令定义处理方式
3. **输出验证** - 强制检查 output 目录
4. **执行示例** - 展示正确和错误的行为