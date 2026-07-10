import { NextResponse } from "next/server";
import sp500 from "@/data/sp500.json";
import { scanTickers, buildScreenerResponse, type Ticker } from "@/lib/screener";

export const dynamic = "force-dynamic"; // 매 요청마다 실행, 개별 fetch는 자체 캐시(next.revalidate) 사용
export const maxDuration = 120; // Vercel 서버리스 함수 최대 실행 시간(초)

const tickers: Ticker[] = (sp500 as { symbol: string; name: string; sector: string }[]).map(
  (t) => ({ ...t, market: "US" })
);

export async function GET() {
  const all = await scanTickers(tickers);
  return NextResponse.json(buildScreenerResponse("S&P 500", tickers.length, all));
}
