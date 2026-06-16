import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/usageDb";
import { getApiKeyById } from "@/lib/localDb";

// Sentinel for an apiKeyId that resolves to no key — guarantees the SQL filter
// matches nothing. Real API keys never collide with this value.
const UNRESOLVED_API_KEY = "__unresolved_api_key__";

/**
 * GET /api/usage/request-details
 * Query parameters: page, pageSize (1-100), provider, model, connectionId, apiKeyId, project, status, startDate, endDate
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page")) || 1;
    const pageSize = parseInt(searchParams.get("pageSize")) || 20;
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");
    const connectionId = searchParams.get("connectionId");
    const apiKeyId = searchParams.get("apiKeyId");
    const project = searchParams.get("project");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (page < 1) {
      return NextResponse.json(
        { error: "Page must be >= 1" },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: "PageSize must be between 1 and 100" },
        { status: 400 }
      );
    }

    const filter = {
      page,
      pageSize
    };

    if (provider) filter.provider = provider;
    if (model) filter.model = model;
    if (connectionId) filter.connectionId = connectionId;
    if (project) filter.project = project;

    // Filter by API key id, not the secret value: resolve the id to its stored
    // key value server-side so the raw key never travels in the request URL /
    // access logs (ISO 27001 A.10/A.12.4). An unknown id matches nothing.
    if (apiKeyId) {
      const apiKeyRecord = await getApiKeyById(apiKeyId);
      filter.apiKey = apiKeyRecord?.key || UNRESOLVED_API_KEY;
    }
    if (status) filter.status = status;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    const result = await getRequestDetails(filter);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to get request details:", error);
    return NextResponse.json(
      { error: "Failed to fetch request details" },
      { status: 500 }
    );
  }
}
