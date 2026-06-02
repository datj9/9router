import { getModelsByProviderId } from "open-sse/config/providerModels.js";

export const DEFAULT_QUOTA_DEPLETED_THRESHOLD = 0;

/**
 * Calculate remaining percentage.
 * @param {number} used Used amount
 * @param {number} total Total amount
 * @returns {number} Remaining percentage (0-100)
 */
export function calculatePercentage(used, total) {
  if (!total || total === 0) return 0;
  if (!used || used < 0) return 100;
  if (used >= total) return 0;

  return Math.round(((total - used) / total) * 100);
}

/**
 * Get remaining percentage from a normalized quota row.
 * Note: normalized `remaining` means percentage, not absolute credits.
 * @param {Object} quota Normalized quota object
 * @returns {number} Remaining percentage (0-100)
 */
export function getRemainingPercentage(quota) {
  if (quota?.remaining !== undefined) {
    return Math.min(100, Math.max(0, Math.round(quota.remaining)));
  }

  if (quota?.remainingPercentage !== undefined) {
    return Math.min(100, Math.max(0, Math.round(quota.remainingPercentage)));
  }

  return calculatePercentage(quota?.used, quota?.total);
}

/**
 * Parse provider-specific quota structures into normalized array.
 * @param {string} provider Provider name
 * @param {Object} data Raw quota data from provider
 * @returns {Array<Object>} Normalized quota objects
 */
export function parseQuotaData(provider, data) {
  if (!data || typeof data !== "object") return [];

  const normalizedQuotas = [];

  try {
    switch ((provider || "").toLowerCase()) {
      case "github":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "antigravity":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([modelKey, quota]) => {
            normalizedQuotas.push({
              name: quota.displayName || modelKey,
              modelKey,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remainingPercentage: quota.remainingPercentage,
            });
          });
        }
        break;

      case "codex":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            normalizedQuotas.push({
              name: quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              remaining: quota.remaining,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "kiro":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            normalizedQuotas.push({
              name: quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "qoder":
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([quotaType, quota]) => {
            if (quotaType === "organization" && (!quota || (Number(quota.total) || 0) === 0)) {
              return;
            }
            normalizedQuotas.push({
              name: quotaType === "user" ? "Personal" : quotaType === "organization" ? "Organization" : quotaType,
              used: quota.used || 0,
              total: quota.total || 0,
              unit: quota.unit,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      case "claude":
        if (data.message) {
          normalizedQuotas.push({
            name: "error",
            used: 0,
            total: 0,
            resetAt: null,
            message: data.message,
          });
        } else if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
            });
          });
        }
        break;

      default:
        if (data.quotas) {
          Object.entries(data.quotas).forEach(([name, quota]) => {
            normalizedQuotas.push({
              name,
              used: quota.used || 0,
              total: quota.total || 0,
              resetAt: quota.resetAt || null,
              remaining: quota.remaining,
              remainingPercentage: quota.remainingPercentage,
              unlimited: quota.unlimited,
            });
          });
        }
    }
  } catch (error) {
    console.error(`Error parsing quota data for ${provider}:`, error);
    return [];
  }

  const modelOrder = getModelsByProviderId(provider);
  if (modelOrder.length > 0) {
    const orderMap = new Map(modelOrder.map((m, i) => [m.id, i]));

    normalizedQuotas.sort((a, b) => {
      const keyA = a.modelKey || a.name;
      const keyB = b.modelKey || b.name;
      const orderA = orderMap.get(keyA) ?? 999;
      const orderB = orderMap.get(keyB) ?? 999;
      return orderA - orderB;
    });
  }

  return normalizedQuotas;
}

function hasUsableRemainingField(quota) {
  return quota?.remaining !== undefined || quota?.remainingPercentage !== undefined;
}

function hasUsableTotal(quota) {
  return Number(quota?.total) > 0;
}

export function getActionableQuotaRows(provider, usage) {
  return parseQuotaData(provider, usage).filter((quota) => {
    if (!quota || quota.unlimited === true || quota.message) return false;
    return hasUsableTotal(quota) || hasUsableRemainingField(quota);
  });
}

function getEarliestFutureResetAt(quotas, now = new Date()) {
  const nowMs = now.getTime();
  let earliest = null;

  for (const quota of quotas) {
    if (!quota.resetAt) continue;
    const resetDate = new Date(quota.resetAt);
    const resetMs = resetDate.getTime();
    if (!Number.isFinite(resetMs) || resetMs <= nowMs) continue;
    if (!earliest || resetMs < earliest.getTime()) earliest = resetDate;
  }

  return earliest ? earliest.toISOString() : null;
}

export function evaluateQuotaState(provider, usage, options = {}) {
  const threshold = options.threshold ?? DEFAULT_QUOTA_DEPLETED_THRESHOLD;
  const now = options.now || new Date();
  const quotas = getActionableQuotaRows(provider, usage);

  if (quotas.length === 0) {
    return {
      hasActionableQuota: false,
      isDepleted: false,
      remainingPercent: null,
      quotaResetAt: null,
      reason: "no_actionable_quota",
      quotas,
    };
  }

  const remainingValues = quotas.map(getRemainingPercentage);
  const remainingPercent = Math.min(...remainingValues);
  const allRowsDepleted = remainingValues.every((value) => value <= threshold);
  const hardDepleted = usage?.isQuotaExceeded === true || (usage?.limitReached === true && allRowsDepleted);
  const isDepleted = hardDepleted || allRowsDepleted;

  return {
    hasActionableQuota: true,
    isDepleted,
    remainingPercent,
    quotaResetAt: getEarliestFutureResetAt(quotas, now),
    reason: isDepleted ? (hardDepleted ? "provider_limit_reached" : "quota_depleted") : "quota_available",
    quotas,
  };
}
