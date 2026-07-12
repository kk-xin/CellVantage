"""
CellVantage - 模拟测试数据生成脚本（修复版）
fix: 加 manufacture_date、test_timestamp 递增确保排序正确
"""

import os
import json
import random
from datetime import datetime, timedelta

random.seed(42)

OUTPUT_DIR = "./output"
CYCLES = 20
CELLS_PER_BATCH = {"normal": 80, "thermal": 10, "resistance": 10}
CELL_CODE_PREFIX = "SIM"
BASE_TIME = datetime(2026, 1, 1, 8, 0, 0)


def make_timestamp(cell_index, cycle):
    return (BASE_TIME + timedelta(hours=cell_index * 12, minutes=cycle * 30)).strftime("%Y-%m-%d %H:%M:%S")


def normal_row(cycle, cell_index, bv=3.65, bir=25.0, bc=2980, bt=25.0):
    d = cycle / CYCLES * 0.02
    return {
        "voltage":             round(bv  - d * bv  + random.uniform(-0.05, 0.05), 3),
        "internal_resistance": round(bir + d * bir + random.uniform(-0.5,  0.5),  2),
        "capacity":            round(bc  - d * bc  + random.uniform(-10,   10),   1),
        "temperature":         round(bt  + random.uniform(-1.5, 1.5),             1),
        "cycle_count":         cycle,
        "test_type":           "cycle_test",
        "test_timestamp":      make_timestamp(cell_index, cycle),
        "notes":               ""
    }


def thermal_row(cycle, cell_index, bv=3.65, bir=24.0, bc=2990, bt=25.0):
    threshold = int(CYCLES * 0.8)
    if cycle <= threshold:
        row = normal_row(cycle, cell_index, bv, bir, bc, bt)
        row["notes"] = ""
        return row
    s = cycle - threshold
    return {
        "voltage":             round(max(bv  - s * random.uniform(0.08, 0.15), 2.0), 3),
        "internal_resistance": round(bir + random.uniform(1, 3), 2),
        "capacity":            round(bc  - s * random.uniform(30, 60), 1),
        "temperature":         round(min(bt + s * random.uniform(6, 10), 90.0), 1),
        "cycle_count":         cycle,
        "test_type":           "cycle_test",
        "test_timestamp":      make_timestamp(cell_index, cycle),
        "notes":               "THERMAL_RUNAWAY"
    }


def resistance_row(cycle, cell_index, bv=3.64, bir=25.0, bc=2970, bt=25.5):
    ir = bir + (cycle / CYCLES) * 20 + random.uniform(-0.5, 0.5)
    return {
        "voltage":             round(bv - (cycle / CYCLES) * 0.05 + random.uniform(-0.03, 0.03), 3),
        "internal_resistance": round(ir, 2),
        "capacity":            round(max(bc - (cycle / CYCLES) * 200 + random.uniform(-15, 15), 2000), 1),
        "temperature":         round(bt + random.uniform(-1, 2), 1),
        "cycle_count":         cycle,
        "test_type":           "cycle_test",
        "test_timestamp":      make_timestamp(cell_index, cycle),
        "notes":               "HIGH_IR" if ir > 35 else ""
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    all_imports = []
    cell_index = 1

    for type_name, count, row_fn in [
        ("normal",     CELLS_PER_BATCH["normal"],     normal_row),
        ("thermal",    CELLS_PER_BATCH["thermal"],    thermal_row),
        ("resistance", CELLS_PER_BATCH["resistance"], resistance_row),
    ]:
        for _ in range(count):
            cell_code = f"{CELL_CODE_PREFIX}-{str(cell_index).zfill(4)}"
            rows = [row_fn(c + 1, cell_index) for c in range(CYCLES)]

            csv_path = os.path.join(OUTPUT_DIR, f"{cell_code}.csv")
            with open(csv_path, "w") as f:
                f.write("cycle_count,voltage,internal_resistance,capacity,temperature,test_type,test_timestamp,notes\n")
                for r in rows:
                    f.write(f"{r['cycle_count']},{r['voltage']},{r['internal_resistance']},"
                            f"{r['capacity']},{r['temperature']},{r['test_type']},"
                            f"{r['test_timestamp']},{r['notes']}\n")

            all_imports.append({"cell_code": cell_code, "type": type_name, "rows": rows})
            cell_index += 1

    with open(os.path.join(OUTPUT_DIR, "bulk_import.json"), "w") as f:
        json.dump(all_imports, f, indent=2)

    print("✅ 生成完成！")
    print(f"   正常: {CELLS_PER_BATCH['normal']} | 热失控: {CELLS_PER_BATCH['thermal']} | 内阻老化: {CELLS_PER_BATCH['resistance']}")
    print(f"   每电池 {CYCLES} 条，共 {100 * CYCLES} 条记录")
    print("下一步：运行 bulk_import.py")


if __name__ == "__main__":
    main()
