"""
CellVantage - 一键批量导入脚本（修复版）
fix: 加 manufacture_date 避免⚠️警告，所有电池统一从 Received 开始
"""

import json, sys, os

try:
    import mysql.connector
except ImportError:
    print("❌ 请先运行：pip install mysql-connector-python")
    sys.exit(1)

DB_CONFIG = {
    "host": "localhost", "port": 3306,
    "user": "cellvantage", "password": "12345678", "database": "cell_vantage"
}
BULK_JSON      = "./output/bulk_import.json"
BATCH_NUMBER   = "SIM-BATCH-2026-01"
BATCH_SUPPLIER = "Simulated Data (CellVantage Demo)"
DELIVERY_DATE  = "2026-01-01"
MANUFACTURE_DATE = "2025-12-01"  # 统一生产日期，消除⚠️警告


def main():
    if not os.path.exists(BULK_JSON):
        print(f"❌ 找不到 {BULK_JSON}，请先运行 generate_test_data.py")
        sys.exit(1)

    with open(BULK_JSON) as f:
        cells_data = json.load(f)

    print(f"📦 读取数据：{len(cells_data)} 个电池，每个 {len(cells_data[0]['rows'])} 条记录")

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 数据库连接失败：{e}"); sys.exit(1)

    try:
        # 创建或复用批次
        cursor.execute("SELECT id FROM batches WHERE batch_number = %s", (BATCH_NUMBER,))
        existing = cursor.fetchone()
        if existing:
            batch_id = existing[0]
            print(f"ℹ️  批次已存在 (id={batch_id})")
        else:
            cursor.execute(
                "INSERT INTO batches (batch_number, supplier, total_quantity, delivery_date, notes) VALUES (%s,%s,%s,%s,%s)",
                (BATCH_NUMBER, BATCH_SUPPLIER, len(cells_data), DELIVERY_DATE, "Auto-generated simulation data")
            )
            batch_id = cursor.lastrowid
            conn.commit()
            print(f"✅ 批次创建完成 (id={batch_id})")

        cells_created = cells_skipped = metrics_created = 0
        errors = []

        for idx, entry in enumerate(cells_data):
            cell_code = entry["cell_code"]
            rows      = entry["rows"]

            cursor.execute("SELECT id FROM cells WHERE cell_code = %s", (cell_code,))
            existing_cell = cursor.fetchone()

            if existing_cell:
                cell_id = existing_cell[0]
                cells_skipped += 1
            else:
                try:
                    cursor.execute(
                        """INSERT INTO cells
                           (cell_code, batch_id, current_state, model,
                            capacity_rated, voltage_nominal, manufacture_date)
                           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                        (cell_code, batch_id, "Received", "21700",
                         3000.0, 3.65, MANUFACTURE_DATE)
                    )
                    cell_id = cursor.lastrowid
                    cells_created += 1
                except Exception as e:
                    errors.append(f"Cell {cell_code}: {e}"); continue

            # 先删旧数据（保持幂等）
            cursor.execute("DELETE FROM cell_metrics_data WHERE cell_id = %s", (cell_id,))

            for row in rows:
                try:
                    cursor.execute(
                        """INSERT INTO cell_metrics_data
                           (cell_id, voltage, internal_resistance, capacity, temperature,
                            cycle_count, test_type, notes, test_timestamp)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (cell_id, row.get("voltage"), row.get("internal_resistance"),
                         row.get("capacity"), row.get("temperature"),
                         row.get("cycle_count"), row.get("test_type"),
                         row.get("notes",""), row.get("test_timestamp"))
                    )
                    metrics_created += 1
                except Exception as e:
                    errors.append(f"Metrics {cell_code} C{row.get('cycle_count')}: {e}")

            if (idx + 1) % 10 == 0:
                conn.commit()
                print(f"   进度：{idx + 1}/{len(cells_data)}", end="\r")

        conn.commit()
        print()
        print("=" * 50)
        print("✅ 导入完成！")
        print(f"   电池新建：{cells_created} 个 | 跳过：{cells_skipped} 个")
        print(f"   Metrics：{metrics_created} 条")
        if errors:
            print(f"   错误：{len(errors)} 条")
            for e in errors[:3]: print(f"     - {e}")
        print("=" * 50)
        print(f"\n💡 测试建议：")
        print(f"   正常电池：analyze SIM-0001")
        print(f"   热失控异常：analyze SIM-0081（需先推进到 Under Test）")
        print(f"   内阻老化异常：analyze SIM-0091（需先推进到 Under Test）")

    except Exception as e:
        conn.rollback()
        print(f"❌ 导入失败：{e}")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
