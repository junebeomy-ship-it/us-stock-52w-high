import { NextResponse } from "next/server";
import { scanRegion, finalizeResults } from "@/lib/screener";

export const dynamic = "force-dynamic"; // 매 요청마다 실행, 개별 fetch는 자체 캐시(next.revalidate) 사용
export const maxDuration = 120; // Vercel 서버리스 함수 최대 실행 시간(초)

export async function GET() {
  try {
    // 미국 전 종목(NYSE·나스닥 등)을 Yahoo 스크리너로 스캔 — 시가총액 순 상위 위주
    const { results, total } = await scanRegion("us");
    return NextResponse.json(
      await finalizeResults("미국 전 종목 (NYSE·나스닥 등)", total, results, { fillSpark: true })
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
