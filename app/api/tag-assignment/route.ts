import {
  assignTag,
  errorResponse,
  positiveInteger,
  StoreError,
  unassignTag,
} from "@/db/store";

export const dynamic = "force-dynamic";

async function objectBody(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return payload as Record<string, unknown>;
  } catch {
    throw new StoreError("Request body must be a JSON object.", 400, "invalid_json");
  }
}

function assignmentIds(payload: Record<string, unknown>) {
  return {
    accountId: positiveInteger(payload.accountId, "accountId"),
    tagId: positiveInteger(payload.tagId, "tagId"),
  };
}

export async function POST(request: Request) {
  try {
    const payload = await objectBody(request);
    if (payload.isPrimary !== undefined && typeof payload.isPrimary !== "boolean") {
      throw new StoreError(
        "isPrimary must be true or false.",
        400,
        "invalid_isPrimary",
      );
    }
    return Response.json(
      await assignTag({
        ...assignmentIds(payload),
        isPrimary: payload.isPrimary as boolean | undefined,
      }),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return Response.json(await unassignTag(assignmentIds(await objectBody(request))), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
