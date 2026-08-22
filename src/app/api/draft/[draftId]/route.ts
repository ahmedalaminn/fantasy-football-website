import { NextResponse } from "next/server";
import { getLiveDraftPicks } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const picks = await getLiveDraftPicks(draftId);
    return NextResponse.json(picks, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft unavailable" },
      { status: 502 },
    );
  }
}
