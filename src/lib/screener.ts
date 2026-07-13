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
  marketCap: number | null;
  spark: number[] | null; // 다운샘플된 1년 종가 (스파크라인용)
};

export const NEAR_HIGH_THRESHOLD = 0.97; // 52주 신고가 대비 97% 이상이면 목록에 포함
const CONCURRENCY = 80;
// 최근 액면분할/병합 등으로 기준이 어긋나면 비정상적으로 큰 괴리가 나타난다. 실제 신고가가 아니므로 제외.
const MAX_SANE_PCT_ABOVE_HIGH = 35;
const UA = "Mozilla/5.0";

function chartUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1y&interval=1d`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// 1년 종가 배열을 ~40포인트로 다운샘플 (스파크라인용, 페이로드 축소)
function downsample(arr: number[], n = 40): number[] | null {
  const clean = (arr || []).filter((x) => typeof x === "number" && isFinite(x));
  if (clean.length === 0) return null;
  if (clean.length <= n) return clean.map(round2);
  const out: number[] = [];
  const step = clean.length / n;
  for (let i = 0; i < n; i++) out.push(clean[Math.floor(i * step)]);
  out.push(clean[clean.length - 1]);
  return out.map(round2);
}

// 차트 신뢰성 검증: 데이터가 너무 적거나(20개 미만) 마지막 종가가 현재가와 25% 이상
// 어긋나면(소형·신규주에서 Yahoo 데이터가 부실한 경우) 차트를 그리지 않는다.
function sanitizeSpark(spark: number[] | null, price: number): number[] | null {
  if (!spark || spark.length < 20) return null;
  const last = spark[spark.length - 1];
  if (!isFinite(last) || last <= 0 || !isFinite(price) || price <= 0) return null;
  if (Math.abs(last / price - 1) > 0.25) return null;
  // 변동이 거의 없는(깨진·평탄한) 데이터는 미표시 — Yahoo의 한국 종목 일봉이 flat하게 오는 경우 대응
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  if (max <= 0 || max - min < max * 0.02) return null;
  return spark;
}

// ---------- Yahoo 인증 (쿠키 + crumb) : 시가총액/스크리너 엔드포인트용 ----------
let cachedAuth: { cookie: string; crumb: string; at: number } | null = null;
async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (cachedAuth && Date.now() - cachedAuth.at < 60 * 60 * 1000) return cachedAuth;
  try {
    const res = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
    const h = res.headers as unknown as { getSetCookie?: () => string[] };
    const setCookies: string[] =
      typeof h.getSetCookie === "function"
        ? h.getSetCookie()
        : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    const crumb = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie },
    }).then((r) => r.text());
    if (!crumb || crumb.length > 40 || crumb.includes("<") || crumb.includes("{")) return null;
    cachedAuth = { cookie, crumb, at: Date.now() };
    return cachedAuth;
  } catch {
    return null;
  }
}

// ---------- 개별 종목 시세 (미국/일본/한국: 차트 엔드포인트) ----------
async function fetchOne(t: Ticker): Promise<StockResult | null> {
  try {
    const res = await fetch(chartUrl(t.symbol), {
      headers: { "User-Agent": UA },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
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
      meta.currency === "KRW" || t.symbol.endsWith(".KS") || t.symbol.endsWith(".KQ");
    const englishName = meta.longName || meta.shortName || null;
    const closes: number[] = result?.indicators?.quote?.[0]?.close || [];
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
      marketCap: null,
      spark: sanitizeSpark(downsample(closes), price),
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

// ---------- 지역 전체 스캔 (홍콩/중국: 스크리너 엔드포인트, 시가총액 포함) ----------
function marketFromExchange(exch: string): string {
  if (/shanghai/i.test(exch)) return "상하이";
  if (/shenzhen/i.test(exch)) return "선전";
  if (/hkse|hong ?kong/i.test(exch)) return "홍콩";
  return exch || "";
}

export async function scanRegion(
  region: string
): Promise<{ results: StockResult[]; total: number }> {
  const auth = await getYahooAuth();
  if (!auth) throw new Error("Yahoo 인증 실패 (crumb)");
  const all: StockResult[] = [];
  const size = 250;
  let offset = 0;
  let total = 0;
  // 안전 상한: 오프셋 12000까지 (Yahoo 스크리너 페이지네이션 한계 대비)
  while (offset < 12000) {
    const body = {
      size,
      offset,
      sortField: "intradaymarketcap",
      sortType: "DESC",
      quoteType: "EQUITY",
      query: { operator: "AND", operands: [{ operator: "EQ", operands: ["region", region] }] },
      userId: "",
      userIdType: "guid",
    };
    let quotes: Array<Record<string, number | string>> = [];
    try {
      const j = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/screener?crumb=${encodeURIComponent(
          auth.crumb
        )}`,
        {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/json", Cookie: auth.cookie },
          body: JSON.stringify(body),
        }
      ).then((r) => r.json());
      const res = j?.finance?.result?.[0];
      if (!res) break;
      total = res.total ?? total;
      quotes = res.quotes || [];
    } catch {
      break;
    }
    if (quotes.length === 0) break;
    for (const q of quotes) {
      const price = q.regularMarketPrice as number;
      const high52w = q.fiftyTwoWeekHigh as number;
      if (typeof price !== "number" || typeof high52w !== "number" || high52w <= 0) continue;
      // 실제 종목만: 워런트·CBBC·파생상품은 시가총액이 없다 → 시가총액 있는 것만 포함
      const mc = q.marketCap;
      if (typeof mc !== "number" || mc <= 0) continue;
      const exch = (q.fullExchangeName as string) || "";
      all.push({
        symbol: q.symbol as string,
        name: (q.longName as string) || (q.shortName as string) || (q.symbol as string),
        sector: (q.sector as string) || "",
        market: marketFromExchange(exch),
        price,
        high52w,
        low52w: (q.fiftyTwoWeekLow as number) ?? 0,
        pctFromHigh: (price / high52w - 1) * 100,
        isNewHigh: price >= high52w,
        currency: (q.currency as string) || "",
        exchange: exch,
        marketCap: mc,
        spark: null,
      });
    }
    offset += size;
    if (total && offset >= total) break;
  }
  // total은 실제 종목(워런트 제외) 수로 표시
  return { results: all, total: all.length };
}

// ---------- 표시 대상(신고가 근접)에만 시가총액/스파크라인 채우기 ----------
async function attachMarketCaps(results: StockResult[]): Promise<void> {
  const need = results.filter((r) => r.marketCap == null).map((r) => r.symbol);
  if (need.length === 0) return;
  const auth = await getYahooAuth();
  if (!auth) return;
  const bySymbol = new Map<string, number>();
  for (let i = 0; i < need.length; i += 100) {
    const batch = need.slice(i, i + 100);
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        batch.join(",")
      )}&crumb=${encodeURIComponent(auth.crumb)}`;
      const j = await fetch(url, { headers: { "User-Agent": UA, Cookie: auth.cookie } }).then((r) =>
        r.json()
      );
      for (const q of j?.quoteResponse?.result || []) {
        if (typeof q.marketCap === "number") bySymbol.set(q.symbol, q.marketCap);
      }
    } catch {
      /* 시가총액 실패는 무시 (열에 '-' 표시) */
    }
  }
  for (const r of results) if (bySymbol.has(r.symbol)) r.marketCap = bySymbol.get(r.symbol)!;
}

async function attachSparks(results: StockResult[]): Promise<void> {
  const need = results.filter((r) => r.spark == null);
  for (let i = 0; i < need.length; i += CONCURRENCY) {
    const batch = need.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (r) => {
        try {
          const j = await fetch(chartUrl(r.symbol), {
            headers: { "User-Agent": UA },
            next: { revalidate: 900 },
          }).then((x) => x.json());
          const closes: number[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          r.spark = sanitizeSpark(downsample(closes), r.price);
        } catch {
          /* 무시 */
        }
      })
    );
  }
}

export async function finalizeResults(
  universe: string,
  total: number,
  all: StockResult[],
  opts: { fillMarketCap?: boolean; fillSpark?: boolean } = {}
) {
  const near52wHigh = all
    .filter(
      (s) =>
        s.price >= s.high52w * NEAR_HIGH_THRESHOLD && s.pctFromHigh <= MAX_SANE_PCT_ABOVE_HIGH
    )
    .sort((a, b) => b.pctFromHigh - a.pctFromHigh);

  if (opts.fillMarketCap) await attachMarketCaps(near52wHigh);
  if (opts.fillSpark) await attachSparks(near52wHigh);

  return {
    updatedAt: new Date().toISOString(),
    universe,
    scanned: all.length,
    total,
    threshold: NEAR_HIGH_THRESHOLD,
    results: near52wHigh,
  };
}
