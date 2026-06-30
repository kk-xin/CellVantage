// ============================================================
// Guardrail: stateTransition
// ------------------------------------------------------------
// 这是一个独立的"校验层"模块，不依赖 Express 的 req/res。
// 类比 Spring：这就是一个普通的 Validator/Service 类，
// 谁都可以调用它（人类用户的路由 / 以后的 Agent），
// 它只负责回答一个问题："这次状态变更允许吗？"
// 并且永远返回结构化的结果，而不是直接抛 HTTP 错误。
// ============================================================

const db = require('../db');

// Which states each role can transition TO (and FROM)
// 这份规则和 cells.js 里原来的完全一样，只是搬到了这里统一管理
const allowedTransitions = {
  quality_engineer: {
    'Received': ['Incoming QC', 'Failed']
  },
  warehouse_staff: {
    'Incoming QC': ['Storage']
  },
  lab_operator: {
    'Storage': ['Under Test'],
    'Under Test': ['Passed', 'Failed']
  },
  disposal_manager: {
    'Failed': ['Disposed']
  }
};

/**
 * 校验一次状态变更是否合法。
 *
 * @param {Object} params
 * @param {number} params.cellId    - 要变更的电池ID
 * @param {string} params.role      - 发起变更的用户角色
 * @param {string} params.newState  - 想要变更到的目标状态
 * @returns {Promise<Object>} 结构化结果，格式见下方两种情况
 *
 * 校验通过时返回：
 *   { allowed: true, previousState: 'Storage' }
 *
 * 校验不通过时返回（这就是给Agent看的"机器可读报错"）：
 *   {
 *     allowed: false,
 *     error_code: 'INVALID_STATE_TRANSITION' | 'CELL_NOT_FOUND' | 'MISSING_FIELDS',
 *     current_state: 'Disposed',
 *     attempted_state: 'Under Test',
 *     message: '人类可读的说明'
 *   }
 */
async function checkStateTransition({ cellId, role, newState }) {
  if (!newState) {
    return {
      allowed: false,
      error_code: 'MISSING_FIELDS',
      message: 'new_state is required'
    };
  }

  const [cells] = await db.query('SELECT current_state FROM cells WHERE id = ?', [cellId]);

  if (cells.length === 0) {
    return {
      allowed: false,
      error_code: 'CELL_NOT_FOUND',
      message: `Cell with id ${cellId} does not exist`
    };
  }

  const previousState = cells[0].current_state;

  const roleRules = allowedTransitions[role];
  const allowedTargets = roleRules ? roleRules[previousState] : undefined;

  if (!allowedTargets || !allowedTargets.includes(newState)) {
    return {
      allowed: false,
      error_code: 'INVALID_STATE_TRANSITION',
      current_state: previousState,
      attempted_state: newState,
      role,
      message: `${role} cannot change state from ${previousState} to ${newState}`
    };
  }

  return {
    allowed: true,
    previousState
  };
}

module.exports = { checkStateTransition, allowedTransitions };