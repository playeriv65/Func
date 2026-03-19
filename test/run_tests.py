#!/usr/bin/env python3
"""
Magic Func 测试运行器 - 统一测试脚本

用法:
    python run_tests.py              # 运行所有测试
    python run_tests.py --range 1-10 # 运行指定范围
    python run_tests.py --list       # 列出所有测试用例
"""

import requests
import time
import json
import sys
import os
import argparse
from datetime import datetime
from pathlib import Path

# 配置
BASE_URL = "http://localhost:8000"
SCRIPT_DIR = Path(__file__).parent
ASSETS_DIR = SCRIPT_DIR / "assets"
TEST_CASES_FILE = SCRIPT_DIR / "test_cases.json"
LOG_DIR = SCRIPT_DIR / "logs"

# 确保日志目录存在
LOG_DIR.mkdir(exist_ok=True)


def load_test_cases():
    """加载测试用例"""
    with open(TEST_CASES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["tests"]


def upload_file(filename):
    """上传文件到容器"""
    filepath = ASSETS_DIR / filename

    if not filepath.exists():
        print(f"    ⚠️ 文件不存在：{filename}")
        return False

    try:
        with open(filepath, "rb") as f:
            files = {"file": (filename.split("/")[-1], f)}
            resp = requests.post(
                f"{BASE_URL}/api/files/upload", files=files, timeout=30
            )
            return resp.status_code == 200
    except Exception as e:
        print(f"    ⚠️ 上传失败：{e}")
        return False


def clear_input():
    """清空 input 目录"""
    try:
        requests.delete(f"{BASE_URL}/api/files/input", timeout=10)
    except:
        pass


def clear_output():
    """清空 output 目录"""
    try:
        requests.delete(f"{BASE_URL}/api/files/output", timeout=10)
    except:
        pass


def wait_for_task(task_id, timeout=300):
    """等待任务完成"""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{BASE_URL}/api/task/{task_id}", timeout=15)
            data = resp.json()
            if data.get("finished", False):
                return data
        except:
            pass
        time.sleep(3)
    return {"status": "timeout", "stdout": ""}


def get_output_files():
    """获取输出文件列表"""
    try:
        resp = requests.get(f"{BASE_URL}/api/files/output", timeout=10)
        return [f["name"] for f in resp.json().get("files", [])]
    except:
        return []


def check_output_validity(output_files, instruction):
    """检查输出是否有效"""
    if not output_files:
        return False, "无输出文件"

    # 根据指令类型检查输出
    instruction_lower = instruction.lower()

    # 图像转换类
    if any(
        kw in instruction_lower
        for kw in ["jpg", "png", "webp", "gif", "ico", "图片", "图像"]
    ):
        image_exts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".bmp", ".tiff"]
        if any(f.lower().endswith(tuple(image_exts)) for f in output_files):
            return True, None

    # PDF 类
    if "pdf" in instruction_lower:
        if any(f.lower().endswith(".pdf") for f in output_files):
            return True, None

    # 压缩包类
    if any(kw in instruction_lower for kw in ["zip", "压缩包", "解压"]):
        if any(f.lower().endswith(".zip") for f in output_files):
            return True, None
        # 解压任务检查是否有文件输出
        if len(output_files) > 0:
            return True, None

    # 音频视频类
    if any(
        kw in instruction_lower for kw in ["mp3", "wav", "mp4", "webm", "音频", "视频"]
    ):
        media_exts = [".mp3", ".wav", ".mp4", ".webm", ".avi", ".mov", ".ogg", ".flac"]
        if any(f.lower().endswith(tuple(media_exts)) for f in output_files):
            return True, None

    # 文档转换类
    if any(
        kw in instruction_lower for kw in ["docx", "xlsx", "csv", "json", "markdown"]
    ):
        doc_exts = [".docx", ".xlsx", ".csv", ".json", ".md", ".txt", ".html"]
        if any(f.lower().endswith(tuple(doc_exts)) for f in output_files):
            return True, None

    # 字体类
    if any(kw in instruction_lower for kw in ["ttf", "woff", "字体"]):
        if any(f.lower().endswith((".ttf", ".woff", ".woff2")) for f in output_files):
            return True, None

    # 默认：只要有输出文件就认为成功
    if len(output_files) > 0:
        return True, None

    return False, "输出文件格式不符合预期"


def check_agent_behavior(stdout):
    """检查 Agent 是否有问题行为"""
    if not stdout:
        return []

    stdout_lower = stdout.lower()
    issues = []

    # 检查询问用户
    problem_keywords = [
        ("should i", "询问用户"),
        ("do you want", "询问用户"),
        ("would you like", "询问用户"),
        ("你想", "询问用户"),
        ("你可以", "让用户自己执行"),
        ("you can run", "让用户自己执行"),
    ]

    for keyword, issue_type in problem_keywords:
        if keyword in stdout_lower:
            issues.append(f"{issue_type}: '{keyword}'")

    # 检查错误
    if "error" in stdout_lower and "no error" not in stdout_lower:
        if "failed" in stdout_lower or "cannot" in stdout_lower:
            issues.append("执行错误")

    return issues


def run_test(test_case, verbose=False):
    """运行单个测试"""
    test_id = test_case["id"]
    instruction = test_case["instruction"]
    category = test_case["category"]
    upload_files = test_case.get("upload", [])

    try:
        # 清理环境
        clear_output()
        clear_input()

        # 上传文件
        for filename in upload_files:
            if not upload_file(filename):
                return {
                    "id": test_id,
                    "category": category,
                    "success": False,
                    "error": f"文件上传失败：{filename}",
                }

        # 执行任务
        resp = requests.post(
            f"{BASE_URL}/api/execute", json={"instruction": instruction}, timeout=30
        )
        task_id = resp.json().get("task_id")

        if not task_id:
            return {
                "id": test_id,
                "category": category,
                "success": False,
                "error": "无 task_id",
            }

        # 等待完成
        if verbose:
            print("等待任务完成...", end="", flush=True)
        result = wait_for_task(task_id, timeout=300)

        # 获取输出
        output_files = get_output_files()
        stdout = result.get("stdout", "")

        # 检查 Agent 行为
        issues = check_agent_behavior(stdout)

        # 检查输出有效性
        valid, format_error = check_output_validity(output_files, instruction)
        if not valid:
            issues.append(format_error)

        success = len(output_files) > 0 and len(issues) == 0

        return {
            "id": test_id,
            "category": category,
            "instruction": instruction[:60],
            "status": result.get("status"),
            "output_count": len(output_files),
            "output_files": output_files[:5],
            "issues": issues,
            "success": success,
        }

    except Exception as e:
        return {
            "id": test_id,
            "category": category,
            "success": False,
            "error": str(e),
        }


def print_summary(results, start_id, end_id):
    """打印测试总结"""
    total = len(results)
    passed = sum(1 for r in results if r["success"])
    rate = passed / total * 100 if total > 0 else 0

    print("\n" + "=" * 70)
    print(f"测试范围：#{start_id} - #{end_id}")
    print(f"结果：{passed}/{total} ({rate:.1f}%)")

    # 按类别统计
    categories = {}
    for r in results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0}
        categories[cat]["total"] += 1
        if r["success"]:
            categories[cat]["passed"] += 1

    print("\n按类别统计:")
    print("-" * 70)
    print(f"{'类别':<20} {'通过':<8} {'总数':<8} {'通过率':<10}")
    print("-" * 70)
    for cat, stats in sorted(categories.items()):
        rate = stats["passed"] / stats["total"] * 100 if stats["total"] > 0 else 0
        print(f"{cat:<20} {stats['passed']:<8} {stats['total']:<8} {rate:.1f}%")

    # 显示失败详情
    failed = [r for r in results if not r["success"]]
    if failed:
        print("\n" + "=" * 70)
        print("失败测试详情:")
        print("-" * 70)
        for r in failed:
            print(f"#{r['id']} [{r['category']}]: {r['instruction'][:50]}")
            if "error" in r:
                print(f"    错误：{r['error']}")
            if "issues" in r and r["issues"]:
                print(f"    问题：{', '.join(r['issues'])}")
            print()

    return passed, total


def save_report(results, start_id, end_id, passed, total):
    """保存测试报告"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "range": f"{start_id}-{end_id}",
        "total": total,
        "passed": passed,
        "rate": passed / total * 100 if total > 0 else 0,
        "results": results,
    }

    report_file = (
        LOG_DIR / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n报告已保存：{report_file}")
    return report_file


def list_tests():
    """列出所有测试用例"""
    tests = load_test_cases()

    print(f"\n{'ID':<6} {'类别':<20} {'指令':<60}")
    print("-" * 90)
    for t in tests:
        print(f"{t['id']:<6} {t['category']:<20} {t['instruction'][:60]}")
    print("-" * 90)
    print(f"共 {len(tests)} 个测试用例")


def main():
    parser = argparse.ArgumentParser(description="Magic Func 测试运行器")
    parser.add_argument("--range", "-r", help="测试范围，例如：1-10")
    parser.add_argument("--list", "-l", action="store_true", help="列出所有测试用例")
    parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    parser.add_argument("--output", "-o", help="输出报告文件路径")

    args = parser.parse_args()

    if args.list:
        list_tests()
        return

    # 加载测试用例
    tests = load_test_cases()

    # 解析范围
    if args.range:
        parts = args.range.split("-")
        start_id = int(parts[0])
        end_id = int(parts[1]) if len(parts) > 1 else start_id
    else:
        start_id = 1
        end_id = tests[-1]["id"]

    # 过滤测试
    tests_to_run = [t for t in tests if start_id <= t["id"] <= end_id]

    if not tests_to_run:
        print(f"错误：没有找到测试用例 (范围：{start_id}-{end_id})")
        return

    print(f"\n{'=' * 70}")
    print(f"Magic Func 测试运行器")
    print(f"{'=' * 70}")
    print(f"运行测试 #{start_id} 到 #{end_id} (共{len(tests_to_run)}个)")
    print(f"API 地址：{BASE_URL}")
    print(f"资源目录：{ASSETS_DIR}")
    print(f"{'=' * 70}\n")

    # 运行测试
    results = []
    start_time = time.time()

    for i, t in enumerate(tests_to_run, 1):
        print(f"[{i}/{len(tests_to_run)}] #{t['id']} [{t['category']}]", end=" ")

        result = run_test(t, verbose=args.verbose)
        results.append(result)

        if result["success"]:
            print(f"✅ 输出:{result['output_count']}个")
        else:
            print(f"❌ {result.get('error', '验证失败')}")
            if args.verbose and "issues" in result:
                for issue in result["issues"]:
                    print(f"      └─ {issue}")

        time.sleep(0.5)

    # 计算耗时
    elapsed = time.time() - start_time
    hours, remainder = divmod(int(elapsed), 3600)
    minutes, seconds = divmod(remainder, 60)

    # 打印总结
    passed, total = print_summary(results, start_id, end_id)

    # 保存报告
    save_report(results, start_id, end_id, passed, total)

    print(f"\n总耗时：{hours}h {minutes}m {seconds}s")


if __name__ == "__main__":
    main()
