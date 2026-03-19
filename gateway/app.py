"""
Flask Gateway API - 包装 Docker 执行 Goose Agent
"""

from flask import Flask, request, jsonify, send_from_directory
import subprocess
import os
import uuid
from datetime import datetime
import threading
import time
import yaml
import signal
import fcntl

app = Flask(__name__, static_folder="static")

# ============= 安全控制配置 =============
# 任务并发锁 - 防止多个任务同时运行
task_lock = threading.Lock()
active_task_id = None

# 内存限制 - 每个容器最多 4GB
CONTAINER_MEMORY_LIMIT = "4g"

# Goose 超时时间（秒）
GOOSE_TIMEOUT = int(os.environ.get("GOOSE_TIMEOUT", "300"))

# 配置
WORKSPACE_ROOT = os.environ.get("WORKSPACE_ROOT", "/workspace")
INPUT_DIR = os.path.join(WORKSPACE_ROOT, "input")
OUTPUT_DIR = os.path.join(WORKSPACE_ROOT, "output")
SANDBOX_CONTAINER = os.environ.get("SANDBOX_CONTAINER", "magic-func-sandbox")
GOOSE_TIMEOUT = int(os.environ.get("GOOSE_TIMEOUT", "300"))

# 从 goose-recipe.yaml 读取系统提示词
# 文件路径：容器中的 /workspace/goose-recipe.yaml
RECIPE_PATH = os.path.join(WORKSPACE_ROOT, "goose-recipe.yaml")
MAGIC_FUNC_SYSTEM_PROMPT = ""

try:
    with open(RECIPE_PATH, "r", encoding="utf-8") as f:
        recipe = yaml.safe_load(f)
        MAGIC_FUNC_SYSTEM_PROMPT = recipe.get("system_prompt", "")
    print(f"Successfully loaded system prompt from {RECIPE_PATH}")
except Exception as e:
    print(f"Warning: Could not load goose-recipe.yaml: {e}")

# 确保目录存在
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 存储任务状态
tasks = {}


def run_goose_task(task_id, instruction):
    """在 sandbox 容器中执行 Goose 任务，支持流式输出"""
    global active_task_id

    try:
        cmd = [
            "docker",
            "exec",
            "-i",
            SANDBOX_CONTAINER,
            "goose",
            "run",
            "--no-session",
            "--system",
            MAGIC_FUNC_SYSTEM_PROMPT,
            "-i",
            "-",
        ]

        # 使用默认的 subprocess 设置，不创建进程组
        # docker exec 启动的进程会被 docker 守护进程管理
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        stdout_lines = []
        stderr_lines = []

        def read_stream(stream, lines_list):
            """读取流并过滤冗余输出"""
            import re

            # 过滤模式：移除 Goose 的截断提示和冗余信息
            filter_patterns = [
                r"\[Output exceeded \d+ bytes.*?\]",  # 输出截断提示
                r"\[Output exceeded.*?\]",
            ]
            try:
                for line in iter(stream.readline, ""):
                    # 检查是否匹配过滤模式
                    should_filter = False
                    for pattern in filter_patterns:
                        if re.search(pattern, line):
                            should_filter = True
                            break
                    if not should_filter:
                        lines_list.append(line)
                    tasks[task_id]["stdout"] = "".join(lines_list)
            except Exception:
                pass  # 流可能已被关闭
            finally:
                try:
                    stream.close()
                except Exception:
                    pass

        stdout_thread = threading.Thread(
            target=read_stream, args=(proc.stdout, stdout_lines)
        )
        stderr_thread = threading.Thread(
            target=read_stream, args=(proc.stderr, stderr_lines)
        )

        stdout_thread.start()
        stderr_thread.start()

        proc.stdin.write(instruction)
        proc.stdin.close()

        # 等待完成，超时后杀掉 docker exec 进程
        # docker 会自动清理容器内的子进程
        try:
            proc.wait(timeout=GOOSE_TIMEOUT)
        except subprocess.TimeoutExpired:
            # 超时后杀掉 docker exec 进程
            proc.kill()
            proc.wait()  # 等待清理

        stdout_thread.join(timeout=5)
        stderr_thread.join(timeout=5)

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["return_code"] = proc.returncode
        tasks[task_id]["completed_at"] = datetime.now().isoformat()
        tasks[task_id]["finished"] = True

        # 立即释放锁和 active_task_id，不等线程清理
        with task_lock:
            active_task_id = None

        # 后台线程清理（不阻塞）
        stdout_thread.join(timeout=1)
        stderr_thread.join(timeout=1)

    except subprocess.TimeoutExpired:
        tasks[task_id]["status"] = "timeout"
        tasks[task_id]["error"] = f"Task exceeded timeout of {GOOSE_TIMEOUT} seconds"
        with task_lock:
            active_task_id = None
        tasks[task_id]["finished"] = True
    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)
        with task_lock:
            active_task_id = None
        tasks[task_id]["finished"] = True


@app.route("/")
def index():
    """服务前端页面"""
    return send_from_directory("static", "index.html")


@app.route("/api/health", methods=["GET"])
def health():
    """健康检查"""
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "workspace": WORKSPACE_ROOT,
        }
    )


@app.route("/api/execute", methods=["POST"])
def execute():
    """
    执行 Goose 任务
    接收：{ "instruction": "自然语言指令" }
    返回：{ "task_id": "任务 ID" }
    """
    global active_task_id

    data = request.get_json()

    if not data or "instruction" not in data:
        return jsonify({"error": "Missing instruction"}), 400

    # 检查是否有任务正在运行
    if not task_lock.acquire(blocking=False):
        # 锁被占用，检查 active_task_id 是否有效
        if active_task_id and active_task_id in tasks:
            task = tasks[active_task_id]
            if task.get("finished", False):
                # 任务已完成但未清理，重置状态
                active_task_id = None
                task_lock.release()
                # 重新尝试获取锁
                if not task_lock.acquire(blocking=False):
                    return jsonify({"error": "System busy, please retry"}), 503
            else:
                # 真的有其他任务在运行
                return jsonify(
                    {
                        "error": "Another task is already running. Please wait for it to complete.",
                        "active_task_id": active_task_id,
                    }
                ), 429
        else:
            # active_task_id 无效，清理
            active_task_id = None
            task_lock.release()
            # 重新尝试获取锁
            if not task_lock.acquire(blocking=False):
                return jsonify({"error": "System busy, please retry"}), 503

    try:
        instruction = data["instruction"]
        task_id = str(uuid.uuid4())
        active_task_id = task_id

        # 初始化任务状态
        tasks[task_id] = {
            "task_id": task_id,
            "instruction": instruction,
            "status": "running",
            "created_at": datetime.now().isoformat(),
            "finished": False,
        }

        # 异步执行任务
        thread = threading.Thread(target=run_goose_task, args=(task_id, instruction))
        thread.daemon = True
        thread.start()

        # 启动线程后立即释放锁，任务状态由 run_goose_task 管理
        task_lock.release()

        return jsonify(
            {"task_id": task_id, "status": "running", "message": "Task started"}
        )
    except Exception as e:
        task_lock.release()
        return jsonify({"error": str(e)}), 500


@app.route("/api/task/<task_id>", methods=["GET"])
def get_task_status(task_id):
    """获取任务状态"""
    if task_id not in tasks:
        return jsonify({"error": "Task not found"}), 404

    return jsonify(tasks[task_id])


@app.route("/api/files/input", methods=["GET"])
def list_input_files():
    """列出 input 目录的文件"""
    try:
        files = os.listdir(INPUT_DIR)
        return jsonify({"files": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/output", methods=["GET"])
def list_output_files():
    """列出 output 目录的文件"""
    try:
        files = os.listdir(OUTPUT_DIR)
        # 获取文件详细信息
        file_info = []
        for f in files:
            filepath = os.path.join(OUTPUT_DIR, f)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                file_info.append(
                    {
                        "name": f,
                        "size": stat.st_size,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    }
                )
        return jsonify({"files": file_info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/upload", methods=["POST"])
def upload_file():
    """上传文件到 input 目录"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # 保存文件
    filepath = os.path.join(INPUT_DIR, file.filename)
    file.save(filepath)

    return jsonify(
        {"message": "File uploaded", "filename": file.filename, "path": filepath}
    )


@app.route("/api/files/download/<filename>", methods=["GET"])
def download_file(filename):
    """从 output 目录下载文件"""
    try:
        return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route("/api/files/input/<filename>", methods=["DELETE"])
def delete_input_file(filename):
    """删除 input 目录的文件"""
    try:
        filepath = os.path.join(INPUT_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"message": f"File {filename} deleted"})
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/output/<filename>", methods=["DELETE"])
def delete_output_file(filename):
    """删除 output 目录的文件"""
    try:
        filepath = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"message": f"File {filename} deleted"})
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/input", methods=["DELETE"])
def clear_input():
    """清空 input 目录"""
    try:
        for f in os.listdir(INPUT_DIR):
            filepath = os.path.join(INPUT_DIR, f)
            if os.path.isfile(filepath):
                os.remove(filepath)
        return jsonify({"message": "Input directory cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/output", methods=["DELETE"])
def clear_output():
    """清空 output 目录"""
    try:
        for f in os.listdir(OUTPUT_DIR):
            filepath = os.path.join(OUTPUT_DIR, f)
            if os.path.isfile(filepath):
                os.remove(filepath)
        return jsonify({"message": "Output directory cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
