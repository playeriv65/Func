#!/usr/bin/env python3
"""
分批测试运行器 - 支持分段运行120个测试
用法: python batch_test.py [起始ID] [结束ID]
"""

import requests
import time
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"


def load_test_cases():
    with open("/home/playeriv65/program/Func/test/test_cases.json", "r") as f:
        data = json.load(f)
    return data["tests"]


def wait_for_task(task_id, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{BASE_URL}/api/task/{task_id}", timeout=10)
            data = resp.json()
            if data.get("finished", False):
                return data
        except:
            pass
        time.sleep(2)
    return {"status": "timeout", "stdout": ""}


def run_test(test_case):
    test_id = test_case["id"]
    instruction = test_case["instruction"]
    category = test_case["category"]

    try:
        requests.delete(f"{BASE_URL}/api/files/output", timeout=10)

        resp = requests.post(
            f"{BASE_URL}/api/execute", json={"instruction": instruction}, timeout=30
        )
        task_id = resp.json().get("task_id")

        if not task_id:
            return {
                "id": test_id,
                "category": category,
                "success": False,
                "error": "no task_id",
            }

        result = wait_for_task(task_id)

        output_resp = requests.get(f"{BASE_URL}/api/files/output", timeout=10)
        output_files = [f["name"] for f in output_resp.json().get("files", [])]

        stdout = result.get("stdout", "").lower()

        # 检查问题关键词
        issues = []
        problem_keywords = [
            "should i",
            "do you want",
            "you can run",
            "你想",
            "你可以运行",
        ]
        for kw in problem_keywords:
            if kw in stdout:
                issues.append(f"问题关键词: {kw}")
                break

        success = len(output_files) > 0 and len(issues) == 0

        return {
            "id": test_id,
            "category": category,
            "instruction": instruction[:60],
            "status": result.get("status"),
            "output_count": len(output_files),
            "issues": issues,
            "success": success,
        }

    except Exception as e:
        return {"id": test_id, "category": category, "success": False, "error": str(e)}


def main():
    tests = load_test_cases()

    # 解析参数
    start_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    end_id = int(sys.argv[2]) if len(sys.argv) > 2 else 120

    # 过滤测试范围
    tests_to_run = [t for t in tests if start_id <= t["id"] <= end_id]

    print(f"运行测试 #{start_id} 到 #{end_id} (共{len(tests_to_run)}个)")
    print("=" * 60)

    results = []
    passed = 0

    for i, t in enumerate(tests_to_run, 1):
        print(
            f"[{i}/{len(tests_to_run)}] #{t['id']} [{t['category']}]...",
            end=" ",
            flush=True,
        )
        result = run_test(t)
        results.append(result)

        if result["success"]:
            passed += 1
            print(f"✅ 输出:{result['output_count']}个")
        else:
            print(f"❌ {result.get('error', 'no output')}")

        time.sleep(0.5)

    # 保存结果
    report = {
        "timestamp": datetime.now().isoformat(),
        "range": f"{start_id}-{end_id}",
        "total": len(tests_to_run),
        "passed": passed,
        "rate": passed / len(tests_to_run) * 100,
    }

    print("\n" + "=" * 60)
    print(
        f"结果: {passed}/{len(tests_to_run)} ({passed / len(tests_to_run) * 100:.1f}%)"
    )

    # 显示失败详情
    failed = [r for r in results if not r["success"]]
    if failed:
        print(f"\n失败测试:")
        for r in failed:
            print(f"  #{r['id']}: {r.get('instruction', 'N/A')[:40]}")


if __name__ == "__main__":
    main()
