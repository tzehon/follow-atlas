import {
  errorResponse,
  importSnapshot,
  StoreError,
  validateImportAccounts,
} from "@/db/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new StoreError("Request body must be valid JSON.", 400, "invalid_json");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new StoreError(
        "Request body must be an object containing accounts.",
        400,
        "invalid_payload",
      );
    }
    const accounts = validateImportAccounts(
      (payload as Record<string, unknown>).accounts,
    );
    return Response.json(await importSnapshot(accounts), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
