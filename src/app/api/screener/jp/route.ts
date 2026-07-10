import { NextResponse } from "next/server";
import jpx from "@/data/jpx.json";
import { scanTickers, buildScreenerResponse, type Ticker } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type JpxRow = { code: string; name: string; market: "Prime" | "Standard" | "Growth"; sector: string };

const tickers: Ticker[] = (jpx as JpxRow[]).map((r) => ({
  symbol: `${r.code}.T`,
  name: r.name,
  sector: r.sector,
  market: r.market,
}));

export async function GET() {
  const all = await scanTickers(tickers);
  return NextResponse.json(buildScreenerResponse("TSE Prime/Standard/Growth", tickers.length, all));
}
