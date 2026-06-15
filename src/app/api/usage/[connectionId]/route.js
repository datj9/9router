import { getProviderConnectionById } from "@/lib/localDb";
import { getUsageForConnection, isUsageEligibleConnection } from "@/lib/usage/providerQuota";

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

    if (!isUsageEligibleConnection(connection)) {
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
