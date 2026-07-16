import {
  createCustomTag,
  deleteCustomTag,
  errorResponse,
  positiveInteger,
  StoreError,
  updateCustomTag,
} from "@/db/store";

export const dynamic = "force-dynamic";

async function objectBody(request: Request, allowEmpty = false) {
  const text = await request.text();
  if (!text.trim() && allowEmpty) return {} as Record<string, unknown>;
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new StoreError("Request body must be a JSON object.", 400, "invalid_json");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await objectBody(request);
    return Response.json(
      await createCustomTag({ name: payload.name, color: payload.color }),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await objectBody(request);
    const id = positiveInteger(payload.id, "id");
    return Response.json(
      await updateCustomTag({ id, name: payload.name, color: payload.color }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await objectBody(request, true);
    const queryId = new URL(request.url).searchParams.get("id");
    const id = positiveInteger(payload.id ?? queryId, "id");
    return Response.json(await deleteCustomTag(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
