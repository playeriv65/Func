# Magic Func 测试集

## 目录结构

```
test/
├── run_tests.py          # 统一测试运行器
├── test_cases.json       # 32 个核心测试用例
├── README.md             # 测试说明文档
└── assets/               # 测试资源文件
    ├── images/           # 图像文件 (JPG, PNG, WebP, SVG, etc.)
    ├── audio/            # 音频文件 (MP3, WAV, etc.)
    ├── video/            # 视频文件 (MP4, WebM, etc.)
    ├── documents/        # 文档文件 (PDF, DOCX, XLSX, MD, HTML, etc.)
    ├── data/             # 数据文件 (CSV, JSON, etc.)
    ├── fonts/            # 字体文件 (TTF, etc.)
    └── archives/         # 压缩包文件 (ZIP, etc.)
```

## 使用方法

### 运行所有测试
```bash
python run_tests.py
```

### 运行指定范围测试
```bash
# 运行测试 1-10
python run_tests.py --range 1-10

# 运行测试 20-30
python run_tests.py -r 20-30
```

### 列出所有测试用例
```bash
python run_tests.py --list
```

### 显示详细信息
```bash
python run_tests.py --verbose
```

## 测试用例概览

| ID | 类别 | 测试内容 |
|----|------|----------|
| 1-13 | 图像处理 | WebP/PNG 转 JPG、缩放、压缩、黑白、水印、EXIF 清除、色彩空间、拼接、切图、图标生成、SVG 转 PNG |
| 14 | 音频转换 | MP3 转 WAV |
| 15-19 | 视频处理 | 视频转 WebM、提取音频、消音、GIF 转视频、字幕压制 |
| 20-23 | PDF 处理 | 文字提取、页面转图片、PDF 合并、PDF 压缩 |
| 24-26 | 文档转换 | Markdown 转 PDF、Word 转 PDF、Excel 转 CSV |
| 27-28 | 数据转换 | CSV 转 JSON、JSON 展平 |
| 29-30 | 压缩文件 | 解压、清洗隐藏文件 |
| 31 | 字体转换 | TTF 转 WOFF2 |
| 32 | PDF 转换 | HTML 转 PDF |

## 测试报告

测试报告自动保存在 `logs/` 目录，文件名格式：`test_report_YYYYMMDD_HHMMSS.json`

报告包含：
- 测试时间戳
- 测试范围
- 通过率统计
- 按类别统计
- 详细结果（每个测试的输出文件、问题等）

## 环境要求

- Magic Func 服务运行中 (默认 `http://localhost:8000`)
- Python 3.8+
- 依赖：`requests`

安装依赖：
```bash
pip install requests
```

## 通过标准

测试通过需满足：
1. **有输出文件** - output 目录至少有一个文件
2. **格式正确** - 输出文件格式符合预期（如 JPG 转换任务输出 .jpg 文件）
3. **无问题行为** - Agent 没有询问用户或让用户自己执行

问题行为检测关键词：
- "should i", "do you want", "would you like"
- "你想", "你可以"
- "you can run"

## 容器工具清单

Dockerfile 中预装的实用工具：

### 图像处理
- **ImageMagick** - 图片转换、缩放、裁剪、水印
- **Ghostscript** - PDF 和 PostScript 处理
- **Pillow** - Python 图像处理库
- **ExifTool** - EXIF 元数据读写

### 音视频处理
- **FFmpeg** - 音视频转换、提取、剪辑、压缩

### PDF 处理
- **Poppler** (pdftotext, pdftoppm) - PDF 文字提取、页面转图片
- **PyPDF2** - Python PDF 处理库
- **reportlab** - Python PDF 生成库

### 文档转换
- **Pandoc** - 通用文档格式转换
- **wkhtmltopdf** - HTML 转 PDF
- **python-docx** - Word 文档处理
- **openpyxl** - Excel 文件处理
- **markdown** - Markdown 解析

### 压缩工具
- **zip/unzip** - ZIP 压缩包
- **p7zip** - 7z 压缩包

### 字体处理
- **fonttools** - Python 字体处理库
- **fontconfig** - 字体配置

## 添加新测试

在 `test_cases.json` 中添加测试用例：

```json
{
  "id": 33,
  "category": "图像处理",
  "upload": ["images/photo.webp"],
  "instruction": "自然语言指令描述任务"
}
```

要求：
- `upload` 路径相对于 `assets/` 目录
- `instruction` 使用自然语言，不要过于具体的命令
