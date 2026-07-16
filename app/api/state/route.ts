import { errorResponse, getState } from "@/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
