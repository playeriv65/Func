#!/usr/bin/env python3
"""Sample Python script for testing"""

def calculate_sum(numbers):
    """Calculate sum of a list of numbers"""
    return sum(numbers)

def calculate_average(numbers):
    """Calculate average of a list of numbers"""
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

def main():
    data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    print(f"Sum: {calculate_sum(data)}")
    print(f"Average: {calculate_average(data)}")

if __name__ == "__main__":
    main()
