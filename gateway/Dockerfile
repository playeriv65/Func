FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# 安装基础工具和 docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    docker.io \
    ca-certificates \
    gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码和静态文件
# app.py 放在根目录，static 文件夹在其旁边
COPY gateway/app.py .
COPY gateway/static/ ./static/

ENV WORKSPACE_ROOT=/workspace
ENV SANDBOX_CONTAINER=magic-func-sandbox
ENV GOOSE_TIMEOUT=300

EXPOSE 8000

CMD ["python", "app.py"]
