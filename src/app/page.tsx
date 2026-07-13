"use client";

import { useEffect, useMemo, useState } from "react";

type StockResult = {
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
  spark: number[] | null;
};

type ApiResponse = {
  updatedAt: string;
  universe: string;
  scanned: number;
  total: number;
  threshold: number;
  results: StockResult[];
};

type Market = "US" | "KR" | "JP" | "HK" | "CN";

const MARKET_CONFIG: Record<
  Market,
  { label: string; flag: string; endpoint: string; universeDesc: string; categoryLabel: string }
> = {
  US: {
    label: "미국",
    flag: "🇺🇸",
    endpoint: "/api/screener/us",
    universeDesc: "미국 전 종목 (NYSE·나스닥 등)",
    categoryLabel: "거래소",
  },
  KR: {
    label: "한국",
    flag: "🇰🇷",
    endpoint: "/api/screener/kr",
    universeDesc: "코스피 + 코스닥 전 종목",
    categoryLabel: "시장",
  },
  JP: {
    label: "일본",
    flag: "🇯🇵",
    endpoint: "/api/screener/jp",
    universeDesc: "도쿄증권거래소 프라임/스탠다드/그로스 전 종목",
    categoryLabel: "시장",
  },
  HK: {
    label: "홍콩",
    flag: "🇭🇰",
    endpoint: "/api/screener/hk",
    universeDesc: "홍콩 거래소 전 종목",
    categoryLabel: "시장",
  },
  CN: {
    label: "중국",
    flag: "🇨🇳",
    endpoint: "/api/screener/cn",
    universeDesc: "상하이·선전 전 종목",
    categoryLabel: "거래소",
  },
};

function categoryOf(r: StockResult): string {
  return r.market || r.sector;
}

function currencySymbol(cur: string): string {
  if (cur === "KRW") return "₩";
  if (cur === "JPY") return "¥";
  if (cur === "CNY") return "¥";
  if (cur === "HKD") return "HK$";
  if (cur === "USD") return "$";
  return "";
}

function formatAmount(currency: string, value: number): string {
  if (currency === "KRW") return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  if (currency === "JPY") return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  if (currency === "CNY") return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  if (currency === "HKD") return `HK$${value.toLocaleString("en-HK", { maximumFractionDigits: 2 })}`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(r: StockResult): string {
  return formatAmount(r.currency, r.price);
}

function formatMarketCap(cur: string, v: number | null): string {
  if (v == null || !isFinite(v)) return "-";
  const s = currencySymbol(cur);
  if (cur === "USD") {
    if (v >= 1e12) return `${s}${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `${s}${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${s}${(v / 1e6).toFixed(0)}M`;
    return `${s}${Math.round(v).toLocaleString()}`;
  }
  // 아시아 통화: 조 / 억 단위
  if (v >= 1e12) return `${s}${(v / 1e12).toFixed(2)}조`;
  if (v >= 1e8) return `${s}${Math.round(v / 1e8).toLocaleString("ko-KR")}억`;
  return `${s}${Math.round(v).toLocaleString("ko-KR")}`;
}

function Sparkline({ data }: { data: number[] | null }) {
  if (!data || data.length < 2) return <span className="text-zinc-300">-</span>;
  const w = 68;
  const h = 22;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  const color = up ? "#059669" : "#dc2626";
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const [market, setMarket] = useState<Market>("US");
  const [dataByMarket, setDataByMarket] = useState<Partial<Record<Market, ApiResponse>>>({});
  const [errorByMarket, setErrorByMarket] = useState<Partial<Record<Market, string>>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");

  const data = dataByMarket[market];
  const error = errorByMarket[market];
  const cfg = MARKET_CONFIG[market];

  useEffect(() => {
    if (dataByMarket[market] || errorByMarket[market]) return;
    fetch(cfg.endpoint)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error((j && j.error) || `요청 실패 (${res.status})`);
        }
        return res.json();
      })
      .then((json: ApiResponse) => setDataByMarket((prev) => ({ ...prev, [market]: json })))
      .catch((e) =>
        setErrorByMarket((prev) => ({ ...prev, [market]: e.message as string }))
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const categories = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.results.map((r) => categoryOf(r)))).sort();
  }, [data, market]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.results.filter((r) => {
      const matchesQuery =
        query.trim() === "" ||
        r.symbol.toLowerCase().includes(query.trim().toLowerCase()) ||
        r.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesCategory = category === "전체" || categoryOf(r) === category;
      return matchesQuery && matchesCategory;
    });
  }, [data, query, category, market]);

  function switchMarket(m: Market) {
    setMarket(m);
    setQuery("");
    setCategory("전체");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {cfg.flag} {cfg.label} 주식 52주 신고가 스크리너
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {cfg.universeDesc} 중 52주 최고가에 근접했거나(97% 이상) 새로 경신한 종목을 보여줍니다.
          </p>
          {data && (
            <p className="mt-1 text-xs text-zinc-500">
              업데이트: {new Date(data.updatedAt).toLocaleString("ko-KR")} · 스캔 {data.scanned}/
              {data.total}개 종목 · 조건에 해당하는 종목 {data.results.length}개
            </p>
          )}
        </header>

        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
          {(Object.keys(MARKET_CONFIG) as Market[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMarket(m)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                market === m
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {MARKET_CONFIG[m].flag} {MARKET_CONFIG[m].label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            데이터를 불러오지 못했습니다: {error}
          </div>
        )}

        {!data && !error && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            {cfg.universeDesc} 종목의 시세를 불러오는 중입니다. 최초 로드는 다소 시간이 걸릴 수 있습니다...
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="text"
                placeholder="티커 또는 종목명 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-xs"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:w-auto"
              >
                <option value="전체">전체 {cfg.categoryLabel}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">티커</th>
                    <th className="px-4 py-3">종목명</th>
                    <th className="px-4 py-3">{cfg.categoryLabel}</th>
                    <th className="px-4 py-3 text-right">현재가</th>
                    <th className="px-4 py-3 text-right">시가총액</th>
                    <th className="px-4 py-3 text-right">52주 최고가</th>
                    <th className="px-4 py-3 text-right">고점 대비</th>
                    <th className="px-4 py-3 text-center">1년 차트</th>
                    <th className="px-4 py-3 text-center">신고가</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.symbol}
                      className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <td className="px-4 py-3 font-semibold">{r.symbol}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{categoryOf(r)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(r)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                        {formatMarketCap(r.currency, r.marketCap)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                        {formatAmount(r.currency, r.high52w)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          r.pctFromHigh >= 0 ? "text-emerald-600" : "text-zinc-600"
                        }`}
                      >
                        {r.pctFromHigh >= 0 ? "+" : ""}
                        {r.pctFromHigh.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Sparkline data={r.spark} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.isNewHigh && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            신고가
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                        조건에 맞는 종목이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="mt-10 space-y-1.5 border-t border-zinc-200 pt-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">신고가 선정 기준</span> — 현재가가
            52주 최고가의 <span className="font-medium">97% 이상(근접)</span>이거나 52주 신고가를 새로 경신한
            종목을 보여줍니다. (고점 대비 이상치는 제외)
          </p>
          <p>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">시가총액 하한</span> — 시장별 통화를
            달러로 환산해 적용합니다. 미국은 <span className="font-medium">10억 달러($1B)</span> 이상, 일본·홍콩·중국은{" "}
            <span className="font-medium">1억 달러($100M)</span> 이상, 한국은{" "}
            <span className="font-medium">제한 없음(코스피·코스닥 전 종목)</span>. SPAC(기업인수목적회사)과 장외(OTC)
            종목은 제외합니다.
          </p>
          <p>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">대상 시장</span> — 미국(NYSE·나스닥·AMEX)
            / 한국(코스피·코스닥) / 일본(도쿄증권거래소 프라임·스탠다드·그로스) / 홍콩 / 중국(상하이·선전).
          </p>
          <p className="text-zinc-400 dark:text-zinc-500">
            데이터 출처: Yahoo Finance (비공식, 한국 차트는 네이버 금융) · 시세는 지연될 수 있으며 투자 판단의
            참고용입니다. 투자 조언이 아닙니다.
          </p>
        </footer>
      </main>
    </div>
  );
}
