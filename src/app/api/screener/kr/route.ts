import { NextResponse } from "next/server";
import krx from "@/data/krx.json";
import { scanTickers, finalizeResults, type Ticker } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type KrxRow = { code: string; name: string; market: "KOSPI" | "KOSDAQ"; sector: string };

const suffix: Record<KrxRow["market"], string> = { KOSPI: ".KS", KOSDAQ: ".KQ" };

const tickers: Ticker[] = (krx as KrxRow[]).map((r) => ({
  symbol: `${r.code}${suffix[r.market]}`,
  name: r.name,
  sector: r.sector,
  market: r.market,
}));

export async function GET() {
  const all = await scanTickers(tickers);
  return NextResponse.json(
    await finalizeResults("KOSPI + KOSDAQ", tickers.length, all, {
      fillMarketCap: true,
      fillSpark: true,
    })
  );
}
