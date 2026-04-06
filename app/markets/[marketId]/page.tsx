"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAddress, formatTimeAgo, formatTokens } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
import { VALID_MARKET_IDS, getMarketConfig, normalizeMarketId } from "@/lib/markets-config";
import CountdownTimer from "@/components/CountdownTimer";

const MODEL_COLORS = [
  "#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#84CC16",
];

const chartTooltipStyle = {
  background: "rgba(24, 24, 27, 0.96)",
  border: "1px solid rgba(63, 63, 70, 0.45)",
  borderRadius: "12px",
  fontSize: "12px",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

interface MarketTrade {
  id: string;
  txHash: string;
  trader: string;
  isBuy: boolean;
  modelIdx: string;
  tokensDelta: string;
  sharesDelta: string;
  impliedProbability: number | null;
  blockTime: string;
}

interface MarketDetailResponse {
  market: {
    marketId: string;
    title: string | null;
    description: string | null;
    category: string | null;
    configUri: string | null;
    status: number;
    statusLabel: string;
    winningModelIdx?: string | null;
    createdAt?: string | null;
    endTime?: string | null;
    settledAt?: string | null;
    totalTrades: number;
    totalVolume: string;
    modelsJson?: unknown;
  };
  latestPrices: Array<{
    modelIdx: string;
    price: string;
    probability: number | null;
  }>;
  priceHistory: Record<string, Array<{ time: string; probability: number }>>;
  recentTrades: MarketTrade[];
}

interface ChartRow {
  time: string;
  label: string;
  [key: string]: string | number | null;
}

interface EntryCard {
  idx: number;
  name: string;
  family: string;
  isWinner: boolean;
  rawProbability: number | null;
  displayProbability: number;
  recentTrades: number;
  recentChange: number | null;
  seriesKey: string;
}

interface PageProps {
  params: { marketId: string };
}

function getSeriesKey(idx: number): string {
  return `m_${idx}`;
}

function formatVolume(vol: string): string {
  try {
    const num = Number(BigInt(vol)) / 1e18;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(2);
  } catch {
    return "0.00";
  }
}

function formatAxisTime(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTooltipTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCalendarDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toConfigUriHref(configUri?: string | null): string | null {
  if (!configUri) return null;
  if (configUri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${configUri.slice("ipfs://".length)}`;
  }
  return configUri;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildChartRows(
  models: Array<{ idx: number }>,
  recentTrades: MarketTrade[]
): ChartRow[] {
  const sortedTrades = [...recentTrades].sort(
    (a, b) => new Date(a.blockTime).getTime() - new Date(b.blockTime).getTime()
  );

  if (sortedTrades.length === 0) {
    return [];
  }

  const latestValues = new Map<string, number | null>();
  const rows: ChartRow[] = [];

  for (const trade of sortedTrades) {
    latestValues.set(trade.modelIdx, trade.impliedProbability ?? null);

    const row: ChartRow = {
      time: trade.blockTime,
      label: formatAxisTime(trade.blockTime),
    };

    for (const model of models) {
      row[getSeriesKey(model.idx)] = latestValues.get(String(model.idx)) ?? null;
    }

    rows.push(row);
  }

  return rows;
}

export default function MarketDetailPage({ params }: PageProps) {
  const internalId = normalizeMarketId(params.marketId);
  const config = getMarketConfig(internalId);
  const isValid = Boolean(config) && VALID_MARKET_IDS.includes(internalId);

  const [marketData, setMarketData] = useState<MarketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValid) {
      setLoading(false);
      return;
    }

    let active = true;

    const fetchMarketData = async () => {
      try {
        const res = await fetch(`/api/markets/${internalId}`);
        const json = await res.json();

        if (!active) return;

        if (!res.ok || json.error) {
          setError(json.error || "Failed to load market");
          return;
        }

        setMarketData(json);
        setError(null);
      } catch (fetchError) {
        if (active) {
          console.error("Failed to fetch market detail:", fetchError);
          setError("Failed to load market data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchMarketData();
    const interval = window.setInterval(fetchMarketData, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [internalId, isValid]);

  const models = config?.models ?? [];
  const isSettled = config?.status === "settled";
  const isActive = config?.status === "active";
  const isOutcome = config?.type === "outcome";
  const entryLabel = isOutcome ? "Outcome" : "Model";
  const entriesLabel = isOutcome ? "Outcomes" : "Models";
  const winnerLabel = isOutcome ? "Winning outcome" : "Winning model";

  const winnerIdx = useMemo(() => {
    if (marketData?.market.winningModelIdx) {
      return Number(marketData.market.winningModelIdx);
    }
    return config?.winnerIdx;
  }, [config?.winnerIdx, marketData?.market.winningModelIdx]);

  const latestProbabilityMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const price of marketData?.latestPrices ?? []) {
      map.set(price.modelIdx, price.probability ?? null);
    }
    return map;
  }, [marketData?.latestPrices]);

  const recentTrades = marketData?.recentTrades ?? [];

  const entryCards = useMemo<EntryCard[]>(() => {
    const sortedTrades = [...recentTrades].sort(
      (a, b) => new Date(a.blockTime).getTime() - new Date(b.blockTime).getTime()
    );

    const tradeCountMap = new Map<string, number>();
    const firstProbabilityMap = new Map<string, number>();
    const lastProbabilityMap = new Map<string, number>();

    for (const trade of sortedTrades) {
      const key = trade.modelIdx;
      tradeCountMap.set(key, (tradeCountMap.get(key) ?? 0) + 1);

      if (typeof trade.impliedProbability === "number") {
        if (!firstProbabilityMap.has(key)) {
          firstProbabilityMap.set(key, trade.impliedProbability);
        }
        lastProbabilityMap.set(key, trade.impliedProbability);
      }
    }

    return models.map((model) => {
      const key = String(model.idx);
      const isWinner = winnerIdx === model.idx;
      const rawProbability =
        latestProbabilityMap.get(key) ??
        lastProbabilityMap.get(key) ??
        null;
      const displayProbability =
        isSettled && winnerIdx !== undefined
          ? (isWinner ? 100 : 0)
          : clampPercent(rawProbability ?? 0);
      const firstProbability = firstProbabilityMap.get(key);
      const lastProbability = lastProbabilityMap.get(key);
      const recentChange =
        !isSettled &&
        firstProbability !== undefined &&
        lastProbability !== undefined
          ? lastProbability - firstProbability
          : null;

      return {
        idx: model.idx,
        name: model.name,
        family: model.family,
        isWinner,
        rawProbability,
        displayProbability,
        recentTrades: tradeCountMap.get(key) ?? 0,
        recentChange,
        seriesKey: getSeriesKey(model.idx),
      };
    });
  }, [isSettled, latestProbabilityMap, models, recentTrades, winnerIdx]);

  const sortedEntryCards = useMemo(() => {
    const cards = [...entryCards];

    if (isOutcome) {
      const yesCard = cards.find((card) => card.name.toUpperCase() === "YES");
      const noCard = cards.find((card) => card.name.toUpperCase() === "NO");
      return [yesCard, noCard].filter(Boolean) as EntryCard[];
    }

    return cards.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (b.displayProbability !== a.displayProbability) {
        return b.displayProbability - a.displayProbability;
      }
      return b.recentTrades - a.recentTrades;
    });
  }, [entryCards, isOutcome]);

  const chartRows = useMemo(() => buildChartRows(models, recentTrades), [models, recentTrades]);

  const yesCard = sortedEntryCards.find((card) => card.name.toUpperCase() === "YES");
  const noCard = sortedEntryCards.find((card) => card.name.toUpperCase() === "NO");
  const leadingEntry = sortedEntryCards[0];
  const winningEntry = sortedEntryCards.find((card) => card.isWinner) ?? leadingEntry;

  const marketTitle = marketData?.market.title || config?.title || `Market #${config?.displayId ?? internalId}`;
  const marketDescription =
    marketData?.market.description ||
    (isOutcome
      ? "Binary Delphi market tracking the final YES or NO resolution."
      : "Benchmark Delphi market comparing model performance and market pricing.");
  const marketCategory =
    marketData?.market.category ||
    (isOutcome ? "Outcome market" : "Benchmark market");
  const configUriHref = toConfigUriHref(marketData?.market.configUri);
  const totalTrades = marketData?.market.totalTrades ?? 0;
  const totalVolume = marketData?.market.totalVolume ?? "0";
  const settlementDate = marketData?.market.settledAt || marketData?.market.endTime || config?.endTimestamp || null;

  if (!isValid || !config) {
    return (
      <div className="page-shell mx-auto max-w-7xl px-4 py-8">
        <section className="section-panel p-10 text-center">
          <p className="text-red-400 text-lg mb-4">Market not found</p>
          <Link href="/markets" className="text-blue-400 hover:underline">
            Back to markets
          </Link>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-shell mx-auto max-w-7xl px-4 py-8">
        <section className="section-panel p-12 text-center">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 mt-4">Loading market intelligence...</p>
        </section>
      </div>
    );
  }

  return (
    <motion.div
      className="page-shell mx-auto max-w-7xl px-4 py-8 space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.section variants={itemVariants} className="page-hero">
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to markets
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
            isSettled ? "badge-settled" : "badge-active"
          }`}>
            {isSettled ? "Settled" : "Live"}
          </span>
          <span className="hero-meta-pill">Market #{config.displayId}</span>
          <span className="hero-meta-pill">{marketCategory}</span>
        </div>

        <div className="page-hero-header mt-5">
          <div className="max-w-4xl">
            <h1 className="page-title text-white">{marketTitle}</h1>
            <p className="page-description mt-4">{marketDescription}</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            {isActive && config.endTimestamp ? (
              <div className="rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
                <CountdownTimer endTimestamp={config.endTimestamp} label="Ends in" />
              </div>
            ) : settlementDate ? (
              <div className="rounded-full border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-200">
                Settled {formatCalendarDate(settlementDate)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="page-stat-grid">
          <div className="page-stat-card">
            <div className="page-stat-label">Total Trades</div>
            <div className="page-stat-value text-blue-400">{totalTrades.toLocaleString()}</div>
            <div className="page-stat-caption">Indexed transactions for this market</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">Volume</div>
            <div className="page-stat-value text-emerald-400">{formatVolume(totalVolume)}</div>
            <div className="page-stat-caption">$TEST across all indexed trades</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">{isSettled ? "Resolution" : "Market Ends"}</div>
            <div className="page-stat-value text-purple-400">
              {settlementDate ? formatCalendarDate(settlementDate) : (config.endDate || "-")}
            </div>
            <div className="page-stat-caption">{winnerLabel}</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">{entriesLabel}</div>
            <div className="page-stat-value text-cyan-400">{models.length}</div>
            <div className="page-stat-caption">Tracked {entriesLabel.toLowerCase()} in this market</div>
          </div>
        </div>
      </motion.section>

      {winningEntry && (
        <motion.section variants={itemVariants} className="section-panel">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                {isSettled ? winnerLabel : "Current leader"}
              </p>
              <h2 className="text-2xl font-semibold text-white mt-2">{winningEntry.name}</h2>
              <p className="text-zinc-400 mt-2">
                {isSettled
                  ? `${winningEntry.family} resolved this market.`
                  : `${winningEntry.family} is leading the board on the latest indexed pricing.`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                {isSettled ? "Final outcome" : "Current probability"}
              </p>
              <p className="text-3xl font-bold text-white mt-2">
                {winningEntry.displayProbability.toFixed(1)}%
              </p>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section variants={itemVariants} className="section-panel">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">
              {isOutcome ? "Outcome board" : "Model board"}
            </h2>
            <p>
              {isOutcome
                ? "Current binary pricing and flow indicators for the market outcomes."
                : "Current pricing board for every model in the benchmark market."}
            </p>
          </div>
        </div>

        <div className={`grid gap-4 ${isOutcome ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
          {sortedEntryCards.map((card) => {
            const trendValue = card.recentChange;
            const trendClass =
              trendValue === null
                ? "text-zinc-500"
                : trendValue > 0
                ? "text-emerald-400"
                : trendValue < 0
                ? "text-red-400"
                : "text-zinc-400";

            return (
              <div
                key={card.idx}
                className={`relative overflow-hidden rounded-2xl border p-4 ${
                  card.isWinner
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-white/8 bg-white/4"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: MODEL_COLORS[card.idx % MODEL_COLORS.length] }}
                      />
                      <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        {entryLabel} #{card.idx}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mt-3 break-words">{card.name}</h3>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-2">
                      {card.family || "Unclassified"}
                    </p>
                  </div>
                  {card.isWinner && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300 bg-amber-500/15 border border-amber-500/25">
                      Winner
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      {isSettled ? "Final result" : "Latest probability"}
                    </p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {card.displayProbability.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Recent move</p>
                    <p className={`text-sm font-semibold mt-1 ${trendClass}`}>
                      {trendValue === null ? "No change" : `${trendValue > 0 ? "+" : ""}${trendValue.toFixed(1)} pts`}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {card.recentTrades} recent trades
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 rounded-full bg-zinc-900/80 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${card.displayProbability}%`,
                      backgroundColor: MODEL_COLORS[card.idx % MODEL_COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="section-panel">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">
              {isOutcome ? "Price action" : "Recent market pricing"}
            </h2>
            <p>Based on the last {recentTrades.length} indexed trades for this market.</p>
          </div>
        </div>

        {chartRows.length > 1 ? (
          <>
            {isOutcome && yesCard && noCard ? (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-5">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={chartRows}>
                      <defs>
                        <linearGradient id={`yes-area-${internalId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id={`no-area-${internalId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(63, 63, 70, 0.35)" />
                      <XAxis
                        dataKey="label"
                        stroke="#71717A"
                        tick={{ fill: "#71717A", fontSize: 11 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="#71717A"
                        tick={{ fill: "#71717A", fontSize: 11 }}
                        tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as ChartRow | undefined;
                          return row ? formatTooltipTime(row.time) : "";
                        }}
                        formatter={(value: number | string | null, name: string) => {
                          const label = name === yesCard.seriesKey ? yesCard.name : noCard.name;
                          return [`${Number(value ?? 0).toFixed(1)}%`, label];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={yesCard.seriesKey}
                        name={yesCard.seriesKey}
                        stroke="#10B981"
                        strokeWidth={2}
                        fill={`url(#yes-area-${internalId})`}
                        connectNulls
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey={noCard.seriesKey}
                        name={noCard.seriesKey}
                        stroke="#EF4444"
                        strokeWidth={2}
                        fill={`url(#no-area-${internalId})`}
                        connectNulls
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {[yesCard, noCard].map((card) => (
                    <div
                      key={card.idx}
                      className="rounded-2xl border border-white/8 bg-white/4 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{card.name}</p>
                          <p className="text-3xl font-bold text-white mt-2">{card.displayProbability.toFixed(1)}%</p>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: MODEL_COLORS[card.idx % MODEL_COLORS.length] }}
                        />
                      </div>
                      <p className="text-sm text-zinc-400 mt-3">
                        {card.recentChange === null
                          ? "No recent change in indexed activity."
                          : `${card.recentChange > 0 ? "Up" : "Down"} ${Math.abs(card.recentChange).toFixed(1)} points across recent trades.`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(63, 63, 70, 0.35)" />
                    <XAxis
                      dataKey="label"
                      stroke="#71717A"
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#71717A"
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as ChartRow | undefined;
                        return row ? formatTooltipTime(row.time) : "";
                      }}
                      formatter={(value: number | string | null, name: string) => {
                        const card = entryCards.find((entry) => entry.seriesKey === name);
                        return [`${Number(value ?? 0).toFixed(1)}%`, card?.name || name];
                      }}
                    />
                    {sortedEntryCards.map((card) => (
                      <Line
                        key={card.idx}
                        type="monotone"
                        dataKey={card.seriesKey}
                        name={card.seriesKey}
                        stroke={MODEL_COLORS[card.idx % MODEL_COLORS.length]}
                        strokeWidth={card.isWinner ? 3 : 2}
                        connectNulls
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-xs text-zinc-500 mt-4">
              Recent pricing is reconstructed from indexed trades because the current analytics backend does not persist full long-range per-model chart history yet.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-10 text-center text-zinc-500">
            Not enough recent price data to render a chart yet.
          </div>
        )}
      </motion.section>

      <motion.section variants={itemVariants} className="section-panel overflow-hidden">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">Recent trades</h2>
            <p>The latest indexed activity flowing through this market.</p>
          </div>
          {isActive && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live feed
            </div>
          )}
        </div>

        {recentTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">{entryLabel}</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Probability</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade) => {
                  const card = entryCards.find((entry) => entry.idx === Number(trade.modelIdx));
                  return (
                    <tr
                      key={trade.id}
                      className="table-row border-b border-[var(--border-color)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            trade.isBuy
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {trade.isBuy ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/address/${trade.trader}`}
                          className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                        >
                          {formatAddress(trade.trader, 4)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: MODEL_COLORS[Number(trade.modelIdx) % MODEL_COLORS.length] }}
                          />
                          <span className="text-sm text-zinc-300 truncate max-w-[220px]">
                            {card?.name || `${entryLabel} ${trade.modelIdx}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-white">
                          {formatTokens(trade.tokensDelta)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-zinc-400">
                          {typeof trade.impliedProbability === "number"
                            ? `${trade.impliedProbability.toFixed(1)}%`
                            : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={LINKS.tx(trade.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {formatTimeAgo(trade.blockTime)}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-zinc-500">No indexed trades yet.</div>
        )}
      </motion.section>

      <motion.section variants={itemVariants} className="section-panel">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">Links and actions</h2>
            <p>Jump straight into Delphi, inspect the contract, or open the market config.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={`https://delphi.gensyn.ai/market/${internalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card glass-hover p-5 block"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Trade</p>
            <h3 className="text-lg font-semibold text-white mt-3">Open on Delphi</h3>
            <p className="text-sm text-zinc-400 mt-2">View the live market and place trades on the source app.</p>
          </a>

          <a
            href={LINKS.contract}
            target="_blank"
            rel="noopener noreferrer"
            className="card glass-hover p-5 block"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Contract</p>
            <h3 className="text-lg font-semibold text-white mt-3">View tracked contract</h3>
            <p className="text-sm text-zinc-400 mt-2">Open the Gensyn explorer page for the Delphi contract.</p>
          </a>

          {configUriHref ? (
            <a
              href={configUriHref}
              target="_blank"
              rel="noopener noreferrer"
              className="card glass-hover p-5 block"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Config</p>
              <h3 className="text-lg font-semibold text-white mt-3">Open raw market config</h3>
              <p className="text-sm text-zinc-400 mt-2">Inspect the metadata source backing this market.</p>
            </a>
          ) : (
            <div className="card p-5 border-dashed border-white/10 bg-black/10">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Config</p>
              <h3 className="text-lg font-semibold text-white mt-3">Config not available</h3>
              <p className="text-sm text-zinc-400 mt-2">No public config URI is stored for this market yet.</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-amber-300 mt-4">
            Live market data is partially degraded right now: {error}
          </p>
        )}
      </motion.section>
    </motion.div>
  );
}
