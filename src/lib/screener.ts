export type Ticker = { symbol: string; name: string; sector: string; market: string };

export type StockResult = {
  symbol: string;
  name: string;
  sector: string;
  market: string;
  price: number;
  high52w: number;
  low52w: number;
  pctFromHigh: number;
  isNewHigh: boolean;
  currency: string;
  exchange: string;
};

export const NEAR_HIGH_THRESHOLD = 0.97; // 52주 신고가 대비 97% 이상이면 목록에 포함
const CONCURRENCY = 80;

async function fetchOne(t: Ticker): Promise<StockResult | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        t.symbol
      )}?range=1y&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 900 },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (
      !meta ||
      typeof meta.regularMarketPrice !== "number" ||
      typeof meta.fiftyTwoWeekHigh !== "number"
    ) {
      return null;
    }
    const price = meta.regularMarketPrice;
    const high52w = meta.fiftyTwoWeekHigh;
    const low52w = meta.fiftyTwoWeekLow ?? 0;
    const pctFromHigh = high52w > 0 ? (price / high52w - 1) * 100 : -Infinity;
    // 한국 종목(KRW)은 저장된 한글 이름 유지, 그 외 국가는 Yahoo가 주는 영어 이름 사용
    const isKorea =
      meta.currency === "KRW" ||
      t.symbol.endsWith(".KS") ||
      t.symbol.endsWith(".KQ");
    const englishName = meta.longName || meta.shortName || null;
    return {
      symbol: t.symbol,
      name: isKorea ? t.name : englishName || t.name,
      sector: t.sector,
      market: t.market,
      price,
      high52w,
      low52w,
      pctFromHigh,
      isNewHigh: price >= high52w,
      currency: meta.currency ?? "USD",
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    };
  } catch {
    return null;
  }
}

export async function scanTickers(tickers: Ticker[]): Promise<StockResult[]> {
  const results: StockResult[] = [];
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map(fetchOne));
    for (const r of settled) if (r) results.push(r);
  }
  return results;
}

// 최근 액면분할/병합 등으로 과거 시세와 현재가의 기준이 어긋나면 52주 최고가 대비
// 비정상적으로 큰 괴리(예: +100%)가 나타난다. 이런 데이터 이상치는 실제 신고가가 아니므로 제외한다.
const MAX_SANE_PCT_ABOVE_HIGH = 35;

export function buildScreenerResponse(universe: string, total: number, all: StockResult[]) {
  const near52wHigh = all
    .filter(
      (s) =>
        s.price >= s.high52w * NEAR_HIGH_THRESHOLD && s.pctFromHigh <= MAX_SANE_PCT_ABOVE_HIGH
    )
    .sort((a, b) => b.pctFromHigh - a.pctFromHigh);

  return {
    updatedAt: new Date().toISOString(),
    universe,
    scanned: all.length,
    total,
    threshold: NEAR_HIGH_THRESHOLD,
    results: near52wHigh,
  };
}
