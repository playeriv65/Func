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

app = Flask(__name__, static_folder="static")

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
    import threading

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
            for line in iter(stream.readline, ""):
                lines_list.append(line)
                tasks[task_id]["stdout"] = "".join(lines_list)
            stream.close()

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

        proc.wait(timeout=GOOSE_TIMEOUT)

        stdout_thread.join()
        stderr_thread.join()

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["return_code"] = proc.returncode
        tasks[task_id]["completed_at"] = datetime.now().isoformat()

        try:
            output_files = os.listdir(OUTPUT_DIR)
            tasks[task_id]["output_files"] = output_files
        except Exception as e:
            tasks[task_id]["output_files"] = []
            tasks[task_id]["error"] = str(e)

    except subprocess.TimeoutExpired:
        tasks[task_id]["status"] = "timeout"
        tasks[task_id]["error"] = f"Task exceeded timeout of {GOOSE_TIMEOUT} seconds"
    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)

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
    data = request.get_json()

    if not data or "instruction" not in data:
        return jsonify({"error": "Missing instruction"}), 400

    instruction = data["instruction"]
    task_id = str(uuid.uuid4())

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

    return jsonify({"task_id": task_id, "status": "running", "message": "Task started"})


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
