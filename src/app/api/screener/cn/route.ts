import { NextResponse } from "next/server";
import { scanRegion, finalizeResults } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const { results, total } = await scanRegion("cn");
    return NextResponse.json(
      await finalizeResults("상하이·선전 전 종목", total, results, { fillSpark: true })
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
