import { getProviderConnections, updateProviderConnection } from "@/lib/localDb";
import { evaluateQuotaState, DEFAULT_QUOTA_DEPLETED_THRESHOLD } from "@/lib/usage/quotaState";
import { getUsageForConnection, isUsageEligibleConnection } from "@/lib/usage/providerQuota";

export const QUOTA_AUTO_TOGGLE_INTERVAL_MS = 15 * 60 * 1000;
export const QUOTA_AUTO_TOGGLE_THRESHOLD = DEFAULT_QUOTA_DEPLETED_THRESHOLD;

function getGlobalSingleton() {
  return global.__appSingleton ??= {};
}

function sanitizeErrorMessage(error) {
  return String(error?.message || error || "Unknown error").replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]");
}

function shouldCheckConnection(connection) {
  return connection?.isActive !== false || connection?.autoDisabledByQuota === true;
}

function buildQuotaFields(nowIso, quotaState, extra = {}) {
  return {
    quotaLastCheckedAt: nowIso,
    quotaLastRemainingPercent: quotaState.remainingPercent,
    quotaResetAt: quotaState.quotaResetAt,
    quotaLastError: null,
    ...extra,
  };
}

export async function runQuotaAutoToggleCheck({ now = new Date(), logger = console } = {}) {
  const nowIso = now.toISOString();
  const connections = await getProviderConnections();
  const summary = {
    checked: 0,
    disabled: 0,
    enabled: 0,
    skipped: 0,
    errored: 0,
  };

  for (const connection of connections) {
    if (!shouldCheckConnection(connection) || !isUsageEligibleConnection(connection)) {
      summary.skipped += 1;
      continue;
    }

    summary.checked += 1;

    try {
      const { usage } = await getUsageForConnection(connection);
      const quotaState = evaluateQuotaState(connection.provider, usage, {
        threshold: QUOTA_AUTO_TOGGLE_THRESHOLD,
        now,
      });

      if (!quotaState.hasActionableQuota) {
        await updateProviderConnection(connection.id, buildQuotaFields(nowIso, quotaState));
        continue;
      }

      if (connection.isActive !== false && quotaState.isDepleted) {
        await updateProviderConnection(connection.id, buildQuotaFields(nowIso, quotaState, {
          isActive: false,
          autoDisabledByQuota: true,
          quotaAutoDisabledAt: nowIso,
        }));
        summary.disabled += 1;
        logger.log?.(`[QuotaAutoToggle] Disabled ${connection.provider}/${connection.id}: ${quotaState.reason}`);
        continue;
      }

      if (connection.isActive !== false && connection.autoDisabledByQuota === true && !quotaState.isDepleted) {
        await updateProviderConnection(connection.id, buildQuotaFields(nowIso, quotaState, {
          autoDisabledByQuota: false,
          quotaAutoDisabledAt: null,
          quotaResetAt: null,
        }));
        continue;
      }

      if (connection.isActive === false && connection.autoDisabledByQuota === true && !quotaState.isDepleted) {
        await updateProviderConnection(connection.id, buildQuotaFields(nowIso, quotaState, {
          isActive: true,
          autoDisabledByQuota: false,
          quotaAutoDisabledAt: null,
          quotaResetAt: null,
        }));
        summary.enabled += 1;
        logger.log?.(`[QuotaAutoToggle] Enabled ${connection.provider}/${connection.id}: quota recovered`);
        continue;
      }

      await updateProviderConnection(connection.id, buildQuotaFields(nowIso, quotaState));
    } catch (error) {
      summary.errored += 1;
      const errorMessage = sanitizeErrorMessage(error);
      logger.warn?.(`[QuotaAutoToggle] ${connection.provider}/${connection.id}: ${errorMessage}`);
      await updateProviderConnection(connection.id, {
        quotaLastCheckedAt: nowIso,
        quotaLastError: errorMessage,
      });
    }
  }

  return summary;
}

export function startQuotaAutoToggleScheduler({ logger = console } = {}) {
  const g = getGlobalSingleton();
  if (g.quotaAutoToggleInterval) return g.quotaAutoToggleInterval;

  const tick = () => {
    if (g.quotaAutoToggleRunning) return;
    g.quotaAutoToggleRunning = true;
    runQuotaAutoToggleCheck({ logger })
      .catch((error) => {
        const errorMessage = sanitizeErrorMessage(error);
        logger.warn?.(`[QuotaAutoToggle] scheduler tick failed: ${errorMessage}`);
      })
      .finally(() => {
        g.quotaAutoToggleRunning = false;
      });
  };

  tick();
  g.quotaAutoToggleInterval = setInterval(tick, QUOTA_AUTO_TOGGLE_INTERVAL_MS);
  if (g.quotaAutoToggleInterval.unref) g.quotaAutoToggleInterval.unref();
  return g.quotaAutoToggleInterval;
}
