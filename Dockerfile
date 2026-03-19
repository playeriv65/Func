FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.local/bin:${PATH}"

# =============================================================================
# 基础工具
# =============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    curl \
    tar \
    bzip2 \
    libgomp1 \
    git \
    apt-utils \
    gnupg \
    wget \
    ca-certificates \
    # 开发工具
    python3 \
    python3-pip \
    python3-venv \
    # 图像处理
    imagemagick \
    ghostscript \
    # 音视频处理
    ffmpeg \
    # PDF 处理
    poppler-utils \
    # 文档转换
    pandoc \
    wkhtmltopdf \
    # 压缩工具
    zip \
    unzip \
    p7zip-full \
    # 字体处理
    fontconfig \
    # 元数据工具
    exiftool \
    # 网络工具
    libcurl4-openssl-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# 安装 UV (Modern Python package manager)
# =============================================================================
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# =============================================================================
# 安装 Node.js 20.x (让 agent 可以用 npx 安装 Skills)
# =============================================================================
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 验证 npx 可用
RUN npx --version

# =============================================================================
# 安装 Goose CLI
# =============================================================================
RUN curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash

# =============================================================================
# 安装 Python 库
# =============================================================================
RUN pip3 install --no-cache-dir \
    # PDF 处理
    PyPDF2 \
    reportlab \
    # 图像处理
    Pillow \
    # 字体处理
    fonttools \
    # Excel 处理
    openpyxl \
    xlrd \
    # Word 处理
    python-docx \
    # Markdown 处理
    markdown \
    # 数据格式转换
    pandas \
    # 网络请求
    requests \
    # HTML 处理
    beautifulsoup4 \
    lxml

# =============================================================================
# 创建工作目录结构
# =============================================================================
RUN mkdir -p /workspace/input /workspace/output /workspace/tmp

WORKDIR /workspace

CMD ["tail", "-f", "/dev/null"]
