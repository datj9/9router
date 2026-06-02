// Ensure proxyFetch is loaded to patch globalThis.fetch
import "open-sse/index.js";

import { updateProviderConnection } from "@/lib/localDb";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { USAGE_APIKEY_PROVIDERS } from "@/shared/constants/providers";
import { getExecutor } from "open-sse/executors/index.js";
import { getUsageForProvider } from "open-sse/services/usage.js";

const AUTH_EXPIRED_PATTERNS = ["expired", "authentication", "unauthorized", "401", "re-authorize"];

export function isAuthExpiredMessage(usage) {
  if (!usage?.message) return false;
  const msg = usage.message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((p) => msg.includes(p));
}

export function isUsageEligibleConnection(connection) {
  if (!connection) return false;
  if (connection.authType === "oauth") return true;
  return connection.authType === "apikey" && USAGE_APIKEY_PROVIDERS.includes(connection.provider);
}

export async function refreshAndUpdateCredentials(connection, force = false, proxyOptions = null) {
  const executor = getExecutor(connection.provider);

  const credentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt || connection.tokenExpiresAt,
    providerSpecificData: connection.providerSpecificData,
    copilotToken: connection.providerSpecificData?.copilotToken,
    copilotTokenExpiresAt: connection.providerSpecificData?.copilotTokenExpiresAt,
  };

  const needsRefresh = force || executor.needsRefresh(credentials);

  if (!needsRefresh) {
    return { connection, refreshed: false };
  }

  const refreshResult = await executor.refreshCredentials(credentials, console, proxyOptions);

  if (!refreshResult) {
    if (connection.accessToken) {
      return { connection, refreshed: false };
    }
    throw new Error("Failed to refresh credentials. Please re-authorize the connection.");
  }

  const now = new Date().toISOString();
  const updateData = {
    updatedAt: now,
  };

  if (refreshResult.accessToken) {
    updateData.accessToken = refreshResult.accessToken;
  }
  if (refreshResult.refreshToken) {
    updateData.refreshToken = refreshResult.refreshToken;
  }
  if (refreshResult.expiresIn) {
    updateData.expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();
  } else if (refreshResult.expiresAt) {
    updateData.expiresAt = refreshResult.expiresAt;
  }
  if (refreshResult.copilotToken || refreshResult.copilotTokenExpiresAt) {
    updateData.providerSpecificData = {
      ...connection.providerSpecificData,
      copilotToken: refreshResult.copilotToken,
      copilotTokenExpiresAt: refreshResult.copilotTokenExpiresAt,
    };
  }

  await updateProviderConnection(connection.id, updateData);

  return {
    connection: {
      ...connection,
      ...updateData,
    },
    refreshed: true,
  };
}

export async function buildUsageProxyOptions(connection) {
  const proxyConfig = await resolveConnectionProxyConfig(connection.providerSpecificData);
  return {
    connectionProxyEnabled: proxyConfig.connectionProxyEnabled === true,
    connectionProxyUrl: proxyConfig.connectionProxyUrl || "",
    connectionNoProxy: proxyConfig.connectionNoProxy || "",
    vercelRelayUrl: proxyConfig.vercelRelayUrl || "",
    strictProxy: false,
  };
}

export async function getUsageForConnection(connection) {
  if (!isUsageEligibleConnection(connection)) {
    const error = new Error("Usage not available for this connection");
    error.statusCode = 400;
    throw error;
  }

  const isOAuth = connection.authType === "oauth";
  const proxyOptions = await buildUsageProxyOptions(connection);
  let currentConnection = connection;
  let refreshed = false;

  if (isOAuth) {
    try {
      const result = await refreshAndUpdateCredentials(currentConnection, false, proxyOptions);
      currentConnection = result.connection;
      refreshed = result.refreshed;
    } catch (refreshError) {
      refreshError.statusCode = 401;
      throw refreshError;
    }
  }

  let usage = await getUsageForProvider(currentConnection, proxyOptions);

  if (isOAuth && isAuthExpiredMessage(usage) && currentConnection.refreshToken) {
    try {
      const retryResult = await refreshAndUpdateCredentials(currentConnection, true, proxyOptions);
      currentConnection = retryResult.connection;
      refreshed = refreshed || retryResult.refreshed;
      usage = await getUsageForProvider(currentConnection, proxyOptions);
    } catch (retryError) {
      console.warn(`[Usage] ${currentConnection.provider}: force refresh failed: ${retryError.message}`);
    }
  }

  return {
    usage,
    connection: currentConnection,
    refreshed,
  };
}
