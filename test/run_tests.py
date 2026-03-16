#!/usr/bin/env python3
"""
Goose Agent 100+ 测试运行器
运行完整的测试套件并生成详细报告
"""

import requests
import time
import json
import os
import sys
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

BASE_URL = "http://localhost:8000"
RESULTS_DIR = "/home/playeriv65/program/Func/test/results"

# 创建结果目录
os.makedirs(RESULTS_DIR, exist_ok=True)


# 线程安全的计数器
class Counter:
    def __init__(self):
        self.value = 0
        self.lock = threading.Lock()

    def increment(self):
        with self.lock:
            self.value += 1
            return self.value


# 加载测试用例
def load_test_cases():
    with open("/home/playeriv65/program/Func/test/test_cases.json", "r") as f:
        data = json.load(f)
    return data["tests"]


# 等待任务完成
def wait_for_task(task_id, timeout=180):
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{BASE_URL}/api/task/{task_id}", timeout=10)
            data = resp.json()
            if data.get("finished", False):
                return data
        except:
            pass
        time.sleep(3)
    return {"status": "timeout", "stdout": ""}


# 分析输出
def analyze_result(stdout, output_files):
    issues = []

    if not output_files:
        issues.append("输出目录为空")
        return issues, False

    stdout_lower = stdout.lower()

    # 问题模式
    problem_keywords = [
        "should i",
        "do you want",
        "would you like",
        "you can run",
        "you should run",
        "please confirm",
        "please specify",
        "你想",
        "您想",
        "你可以运行",
        "请确认",
    ]

    for kw in problem_keywords:
        if kw in stdout_lower:
            issues.append(f"检测到问题关键词: '{kw}'")
            break

    return issues, len(issues) == 0 and len(output_files) > 0


# 运行单个测试
def run_single_test(test_case, counter, total):
    test_id = test_case["id"]
    instruction = test_case["instruction"]
    category = test_case["category"]

    current = counter.increment()
    print(f"[{current}/{total}] 测试 #{test_id} [{category}]: {instruction[:50]}...")

    try:
        # 清理输出目录
        requests.delete(f"{BASE_URL}/api/files/output", timeout=10)

        # 发送任务
        resp = requests.post(
            f"{BASE_URL}/api/execute", json={"instruction": instruction}, timeout=30
        )
        task_id = resp.json().get("task_id")

        if not task_id:
            return {
                "id": test_id,
                "category": category,
                "instruction": instruction,
                "status": "failed",
                "error": "无法获取任务ID",
                "success": False,
            }

        # 等待完成
        result = wait_for_task(task_id)

        # 检查输出
        output_resp = requests.get(f"{BASE_URL}/api/files/output", timeout=10)
        output_files = [f["name"] for f in output_resp.json().get("files", [])]

        # 分析结果
        stdout = result.get("stdout", "")
        issues, success = analyze_result(stdout, output_files)

        status = result.get("status", "unknown")

        icon = "✅" if success else "❌"
        print(f"  {icon} 状态: {status}, 输出文件: {len(output_files)}个")

        return {
            "id": test_id,
            "category": category,
            "instruction": instruction,
            "status": status,
            "output_files": output_files,
            "output_count": len(output_files),
            "issues": issues,
            "success": success,
            "stdout_preview": stdout[:500] if stdout else "",
        }

    except Exception as e:
        print(f"  ❌ 错误: {str(e)}")
        return {
            "id": test_id,
            "category": category,
            "instruction": instruction,
            "status": "error",
            "error": str(e),
            "success": False,
        }


# 运行所有测试
def run_all_tests(tests, max_workers=3):
    results = []
    counter = Counter()
    total = len(tests)

    print(f"\n{'=' * 60}")
    print(f"开始运行 {total} 个测试")
    print(f"{'=' * 60}\n")

    start_time = time.time()

    # 顺序执行（避免并发问题）
    for test in tests:
        result = run_single_test(test, counter, total)
        results.append(result)
        time.sleep(1)  # 短暂间隔

    end_time = time.time()

    return results, end_time - start_time


# 生成报告
def generate_report(results, duration):
    # 按类别统计
    by_category = {}
    for r in results:
        cat = r["category"]
        if cat not in by_category:
            by_category[cat] = {"pass": 0, "fail": 0, "total": 0}
        by_category[cat]["total"] += 1
        if r["success"]:
            by_category[cat]["pass"] += 1
        else:
            by_category[cat]["fail"] += 1

    # 打印摘要
    print(f"\n{'=' * 60}")
    print("测试报告")
    print(f"{'=' * 60}")
    print(f"总测试数: {len(results)}")
    print(f"总耗时: {duration:.1f} 秒")
    print(f"平均每个测试: {duration / len(results):.1f} 秒")

    total_pass = sum(1 for r in results if r["success"])
    print(
        f"\n通过率: {total_pass}/{len(results)} ({total_pass / len(results) * 100:.1f}%)"
    )

    print(f"\n按类别统计:")
    for cat, stats in by_category.items():
        rate = stats["pass"] / stats["total"] * 100 if stats["total"] > 0 else 0
        icon = "✅" if rate == 100 else "⚠️" if rate >= 80 else "❌"
        print(f"  {icon} {cat}: {stats['pass']}/{stats['total']} ({rate:.0f}%)")

    # 失败详情
    failed = [r for r in results if not r["success"]]
    if failed:
        print(f"\n失败测试 ({len(failed)}个):")
        for r in failed[:10]:  # 只显示前10个
            print(f"  ❌ #{r['id']}: {r['instruction'][:40]}...")
            if r.get("issues"):
                print(f"     问题: {r['issues'][0]}")
        if len(failed) > 10:
            print(f"  ... 还有 {len(failed) - 10} 个失败")

    # 保存详细结果
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(results),
        "passed": total_pass,
        "failed": len(results) - total_pass,
        "pass_rate": total_pass / len(results) * 100,
        "duration_seconds": duration,
        "by_category": by_category,
        "results": results,
    }

    report_file = os.path.join(
        RESULTS_DIR, f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n详细报告已保存: {report_file}")

    return report


# 主函数
def main():
    print("=" * 60)
    print("Goose Agent 100+ 测试套件")
    print("=" * 60)

    # 检查服务状态
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print(f"服务状态: {resp.json().get('status', 'unknown')}")
    except:
        print("错误: 无法连接到服务，请确保服务正在运行")
        sys.exit(1)

    # 加载测试用例
    tests = load_test_cases()
    print(f"加载了 {len(tests)} 个测试用例")

    # 运行测试
    results, duration = run_all_tests(tests)

    # 生成报告
    report = generate_report(results, duration)

    # 返回退出码
    if report["pass_rate"] >= 90:
        print("\n🎉 测试通过！")
        sys.exit(0)
    else:
        print(f"\n⚠️ 通过率 {report['pass_rate']:.1f}% 低于 90%")
        sys.exit(1)


if __name__ == "__main__":
    main()
