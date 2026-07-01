// ============================================================
// Agent Module: anomalyDetection
// ------------------------------------------------------------
// 跟 guardrails/stateTransition.js 是同一种设计思路：
// 纯逻辑模块，不碰 req/res，谁都可以调用它
// （现在是 metrics.js 路由调用，以后 Agent 编排层也会直接调用）。
//
// 输入：一个电池的全部测试记录（按时间正序排列）
// 输出：异常列表，每条都是结构化数据，方便人类阅读，也方便以后
//      Agent 直接拿这些字段去生成"审计日志"和决策依据。
// ============================================================

// 阈值先用经验值，以后可以做成可配置项（比如存进数据库或.env）
const THRESHOLDS = {
  INTERNAL_RESISTANCE_MOHM: 35,      // 内阻超过这个值（mΩ）算偏高
  CAPACITY_DROP_PERCENT: 5,          // 相邻两次测试，容量单次跌幅超过这个百分比算骤降
  TEMPERATURE_HIGH_C: 45             // 测试环境温度超过这个值（°C）算过热
};

/**
 * 分析一个电池的全部测试记录，找出异常点。
 *
 * @param {Array<Object>} rows - cell_metrics_data 表的记录，按 test_timestamp 正序排列
 * @returns {Array<Object>} anomalies - 每条异常的结构化描述
 *
 * 每条异常的格式：
 *   {
 *     row_id: 5,                          // cell_metrics_data 表里的主键id，方便定位原始记录
 *     cycle_count: 4,
 *     anomaly_type: 'HIGH_INTERNAL_RESISTANCE' | 'CAPACITY_DROP' | 'OVER_TEMPERATURE',
 *     severity: 'warning' | 'critical',
 *     observed_value: 38.9,
 *     threshold: 35,
 *     message: '人类可读说明'
 *   }
 */
function detectAnomalies(rows) {
  const anomalies = [];

  rows.forEach((row, index) => {
    // 规则1：内阻偏高
    if (row.internal_resistance !== null && row.internal_resistance > THRESHOLDS.INTERNAL_RESISTANCE_MOHM) {
      anomalies.push({
        row_id: row.id,
        cycle_count: row.cycle_count,
        anomaly_type: 'HIGH_INTERNAL_RESISTANCE',
        severity: row.internal_resistance > THRESHOLDS.INTERNAL_RESISTANCE_MOHM * 1.2 ? 'critical' : 'warning',
        observed_value: row.internal_resistance,
        threshold: THRESHOLDS.INTERNAL_RESISTANCE_MOHM,
        message: `Internal resistance ${row.internal_resistance}mΩ exceeds threshold ${THRESHOLDS.INTERNAL_RESISTANCE_MOHM}mΩ`
      });
    }

    // 规则2：环境温度过高
    if (row.temperature !== null && row.temperature > THRESHOLDS.TEMPERATURE_HIGH_C) {
      anomalies.push({
        row_id: row.id,
        cycle_count: row.cycle_count,
        anomaly_type: 'OVER_TEMPERATURE',
        severity: 'critical',
        observed_value: row.temperature,
        threshold: THRESHOLDS.TEMPERATURE_HIGH_C,
        message: `Test temperature ${row.temperature}°C exceeds safe threshold ${THRESHOLDS.TEMPERATURE_HIGH_C}°C`
      });
    }

    // 规则3：容量骤降（需要跟上一条记录比较，所以第一条记录跳过）
    if (index > 0) {
      const prevCapacity = rows[index - 1].capacity;
      const currCapacity = row.capacity;

      if (prevCapacity && currCapacity) {
        const dropPercent = ((prevCapacity - currCapacity) / prevCapacity) * 100;

        if (dropPercent > THRESHOLDS.CAPACITY_DROP_PERCENT) {
          anomalies.push({
            row_id: row.id,
            cycle_count: row.cycle_count,
            anomaly_type: 'CAPACITY_DROP',
            severity: dropPercent > THRESHOLDS.CAPACITY_DROP_PERCENT * 2 ? 'critical' : 'warning',
            observed_value: Number(dropPercent.toFixed(2)),
            threshold: THRESHOLDS.CAPACITY_DROP_PERCENT,
            message: `Capacity dropped ${dropPercent.toFixed(2)}% (from ${prevCapacity}mAh to ${currCapacity}mAh) between cycle ${rows[index - 1].cycle_count} and ${row.cycle_count}`
          });
        }
      }
    }
  });

  return anomalies;
}

module.exports = { detectAnomalies, THRESHOLDS };
