import { getProviderConnectionById } from "@/lib/localDb";
import { getUsageForConnection, isUsageEligibleConnection } from "@/lib/usage/providerQuota";
import { USAGE_APIKEY_PROVIDERS } from "@/shared/constants/providers";

/**
 * GET /api/usage/[connectionId] - Get usage data for a specific connection
 */
export async function GET(request, { params }) {
  let connection;
  try {
    const { connectionId } = await params;

    connection = await getProviderConnectionById(connectionId);
    if (!connection) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    // Allow OAuth connections, plus whitelisted apikey providers (glm/minimax/kiro/...)
    // Kiro's headless api-key flow persists authType "api_key" (underscore) while
    // generic apikey providers persist "apikey" — accept both spellings here.
    const isOAuth = connection.authType === "oauth";
    const isApikeyAuth =
      connection.authType === "apikey" || connection.authType === "api_key";
    const isApikeyEligible =
      isApikeyAuth && USAGE_APIKEY_PROVIDERS.includes(connection.provider);

    if (!isUsageEligibleConnection(connection) && !isOAuth && !isApikeyEligible) {
      return Response.json({ message: "Usage not available for this connection" });
    }

    const { usage } = await getUsageForConnection(connection);
    return Response.json(usage);
  } catch (error) {
    const provider = connection?.provider ?? "unknown";
    console.warn(`[Usage] ${provider}: ${error.message}`);
    if (error.statusCode === 401) {
      return Response.json({
        error: `Credential refresh failed: ${error.message}`,
      }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
