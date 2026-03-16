#!/usr/bin/env python3
"""
快速测试运行器 - 运行前20个测试验证框架
"""

import requests
import time
import json

BASE_URL = "http://localhost:8000"


def load_test_cases():
    with open("/home/playeriv65/program/Func/test/test_cases.json", "r") as f:
        data = json.load(f)
    return data["tests"][:20]  # 只取前20个


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

    print(f"\n[{test_id}] {category}: {instruction[:60]}...")

    try:
        # 清理
        requests.delete(f"{BASE_URL}/api/files/output", timeout=10)

        # 发送任务
        resp = requests.post(
            f"{BASE_URL}/api/execute", json={"instruction": instruction}, timeout=30
        )
        task_id = resp.json().get("task_id")

        if not task_id:
            print(f"  ❌ 无法获取任务ID")
            return False

        # 等待
        result = wait_for_task(task_id)

        # 检查输出
        output_resp = requests.get(f"{BASE_URL}/api/files/output", timeout=10)
        output_files = [f["name"] for f in output_resp.json().get("files", [])]

        status = result.get("status")
        success = len(output_files) > 0

        icon = "✅" if success else "❌"
        print(f"  {icon} {status}, 输出: {len(output_files)}个文件")

        return success

    except Exception as e:
        print(f"  ❌ 错误: {e}")
        return False


def main():
    print("快速测试 - 前20个测试")

    tests = load_test_cases()
    print(f"运行 {len(tests)} 个测试\n")

    passed = 0
    for t in tests:
        if run_test(t):
            passed += 1
        time.sleep(1)

    print(f"\n结果: {passed}/{len(tests)} 通过")

    if passed >= len(tests) * 0.9:
        print("✅ 测试通过!")
    else:
        print("⚠️ 需要检查失败的测试")


if __name__ == "__main__":
    main()
