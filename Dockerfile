FROM ubuntu:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.local/bin:${PATH}"

# 安装基础工具：curl, tar, git, apt-utils, Node.js, npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tar \
    bzip2 \
    libgomp1 \
    git \
    apt-utils \
    gnupg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 UV (Modern Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# 安装 Node.js 20.x (让 agent 可以用 npx 安装 Skills)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 验证 npx 可用
RUN npx --version

# 安装 Goose CLI
RUN curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash

# 创建 workspace 目录结构
RUN mkdir -p /workspace/input /workspace/output /workspace/tmp

WORKDIR /workspace

CMD ["tail", "-f", "/dev/null"]
