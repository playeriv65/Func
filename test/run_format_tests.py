#!/usr/bin/env python3
"""
格式转换测试运行器
测试Agent在各种格式转换场景下的能力
"""

import json
import os
import sys
import time
import requests
import shutil
from pathlib import Path
from datetime import datetime

# 配置
API_BASE = "http://localhost:8000"
INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_DIR = Path(__file__).parent.parent / "workspace" / "output"
WORKSPACE_INPUT = Path(__file__).parent.parent / "workspace" / "input"
TEST_TIMEOUT = 300  # 5分钟


class TestRunner:
    def __init__(self, test_file: str):
        with open(test_file, "r", encoding="utf-8") as f:
            self.test_data = json.load(f)
        self.results = []

    def clear_workspace(self):
        """清空工作目录"""
        for f in WORKSPACE_INPUT.glob("*"):
            if f.is_file():
                f.unlink()
        for f in OUTPUT_DIR.glob("*"):
            if f.is_file():
                f.unlink()
        print("  ✓ 工作目录已清空")

    def upload_file(self, filename: str) -> bool:
        """上传测试文件到workspace/input"""
        # 支持format_conversion子目录
        src = INPUT_DIR / filename
        if not src.exists():
            print(f"  ⚠ 文件不存在: {filename}")
            return False

        dst = WORKSPACE_INPUT / Path(filename).name
        shutil.copy(src, dst)
        return True

    def execute_task(self, instruction: str) -> dict:
        """执行任务并等待完成"""
        # 发送任务
        resp = requests.post(
            f"{API_BASE}/api/execute", json={"instruction": instruction}
        )
        if resp.status_code != 200:
            return {"error": f"API错误: {resp.status_code}"}

        task_id = resp.json().get("task_id")
        print(f"  任务ID: {task_id[:8]}...")

        # 等待完成
        start_time = time.time()
        while time.time() - start_time < TEST_TIMEOUT:
            resp = requests.get(f"{API_BASE}/api/task/{task_id}")
            data = resp.json()

            if data.get("finished"):
                return data

            time.sleep(2)

        return {"error": "任务超时", "timeout": True}

    def check_output(self, expected: list) -> tuple:
        """检查输出文件"""
        files = list(OUTPUT_DIR.glob("*"))
        if not files:
            return False, "输出目录为空"

        # 检查是否匹配预期
        if isinstance(expected, str):
            expected = [expected]

        matched = []
        for exp in expected:
            # 简单的模式匹配
            if exp.startswith("*"):
                # 通配符匹配
                suffix = exp[1:]
                for f in files:
                    if f.name.endswith(suffix) or suffix in f.name:
                        matched.append(f.name)
            elif "*" in exp:
                # 中间通配符
                parts = exp.split("*")
                for f in files:
                    if all(p in f.name for p in parts if p):
                        matched.append(f.name)
            else:
                # 精确匹配
                for f in files:
                    if f.name == exp:
                        matched.append(f.name)

        if matched:
            return True, f"找到文件: {', '.join(matched)}"
        else:
            return False, f"未找到预期文件。现有: {[f.name for f in files]}"

    def run_single_test(self, test_case: dict) -> dict:
        """运行单个测试"""
        result = {
            "id": test_case["id"],
            "name": test_case["name"],
            "category": test_case.get("category", ""),
            "status": "unknown",
            "output_files": [],
            "duration": 0,
            "notes": "",
        }

        print(f"\n{'=' * 60}")
        print(f"[{test_case['id']}] {test_case['name']}")
        print(f"场景: {test_case.get('scenario', 'N/A')}")
        print(f"工具: {test_case.get('tool', 'N/A')}")

        # 清空工作目录
        self.clear_workspace()

        # 上传文件
        upload_files = test_case.get("upload", [])
        for f in upload_files:
            if not self.upload_file(f):
                result["status"] = "skipped"
                result["notes"] = f"测试文件缺失: {f}"
                return result
        print(f"  ✓ 已上传 {len(upload_files)} 个文件")

        # 执行任务
        start = time.time()
        task_result = self.execute_task(test_case["instruction"])
        result["duration"] = round(time.time() - start, 1)

        if "error" in task_result:
            result["status"] = "failed"
            result["notes"] = task_result["error"]
            return result

        # 检查输出
        expected = test_case.get("expected_output", "*")
        success, msg = self.check_output(expected)

        result["output_files"] = task_result.get("output_files", [])

        if success:
            result["status"] = "passed"
            result["notes"] = msg
            print(f"  ✅ 通过: {msg}")
        else:
            result["status"] = "failed"
            result["notes"] = msg
            print(f"  ❌ 失败: {msg}")

        return result

    def run_category(self, category_data: dict):
        """运行一个类别的测试"""
        category = category_data["category"]
        print(f"\n{'#' * 60}")
        print(f"# {category}")
        print(f"# {category_data.get('description', '')}")
        print(f"{'#' * 60}")

        category_results = []
        for test_case in category_data["cases"]:
            result = self.run_single_test(test_case)
            result["category"] = category
            category_results.append(result)
            self.results.append(result)

            # 短暂等待
            time.sleep(1)

        # 类别统计
        passed = sum(1 for r in category_results if r["status"] == "passed")
        total = len(category_results)
        print(f"\n  类别统计: {passed}/{total} 通过")

        return category_results

    def run_all(self, categories: list = None):
        """运行所有测试或指定类别"""
        print("=" * 60)
        print(f"格式转换测试 - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        print("=" * 60)

        for cat_data in self.test_data["tests"]:
            if categories and cat_data["category"] not in categories:
                continue
            self.run_category(cat_data)

        # 总结
        self.print_summary()

    def print_summary(self):
        """打印测试总结"""
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)

        by_status = {"passed": 0, "failed": 0, "skipped": 0}
        by_category = {}

        for r in self.results:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
            cat = r.get("category", "unknown")
            if cat not in by_category:
                by_category[cat] = {"passed": 0, "failed": 0, "total": 0}
            by_category[cat]["total"] += 1
            if r["status"] == "passed":
                by_category[cat]["passed"] += 1
            else:
                by_category[cat]["failed"] += 1

        print(f"\n状态统计:")
        for status, count in by_status.items():
            print(f"  {status}: {count}")

        print(f"\n类别统计:")
        for cat, stats in by_category.items():
            pct = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {cat}: {stats['passed']}/{stats['total']} ({pct:.0f}%)")

        total = len(self.results)
        passed = by_status.get("passed", 0)
        print(f"\n总计: {passed}/{total} 通过 ({passed / total * 100:.1f}%)")

    def save_results(self, filename: str):
        """保存结果到JSON"""
        output = {
            "timestamp": datetime.now().isoformat(),
            "total": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "passed"),
            "results": self.results,
        }
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"\n结果已保存到: {filename}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="格式转换测试运行器")
    parser.add_argument("--category", "-c", help="只运行指定类别")
    parser.add_argument("--list", "-l", action="store_true", help="列出所有类别")
    parser.add_argument("--test-id", "-t", help="运行指定ID的测试")
    args = parser.parse_args()

    test_file = Path(__file__).parent / "format_conversion_tests.json"
    runner = TestRunner(test_file)

    if args.list:
        print("可用测试类别:")
        for cat_data in runner.test_data["tests"]:
            count = len(cat_data["cases"])
            print(f"  - {cat_data['category']} ({count} 测试)")
        return

    if args.test_id:
        # 运行单个测试
        for cat_data in runner.test_data["tests"]:
            for test_case in cat_data["cases"]:
                if test_case["id"] == args.test_id:
                    result = runner.run_single_test(test_case)
                    runner.results.append(result)
                    runner.print_summary()
                    return
        print(f"未找到测试ID: {args.test_id}")
        return

    categories = [args.category] if args.category else None
    runner.run_all(categories)

    # 保存结果
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    runner.save_results(f"test_results_{timestamp}.json")


if __name__ == "__main__":
    main()
