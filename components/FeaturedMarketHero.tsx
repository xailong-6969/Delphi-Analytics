"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import CountdownTimer from "@/components/CountdownTimer";
import type { LiveMarketSummary } from "@/lib/live-markets";
import { parseModelsJson } from "@/lib/utils";

const MODEL_COLORS = [
  "#34d399",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#22d3ee",
  "#84cc16",
];

interface MarketDetailResponse {
  market: {
    marketId: string;
    title: string | null;
    status: number;
    winningModelIdx?: string | null;
    endTime?: string | null;
    modelsJson?: unknown;
  };
  latestPrices: Array<{
    modelIdx: string;
    probability: number | null;
  }>;
  priceHistory: Record<string, Array<{ time: string; probability: number }>>;
}

interface FeaturedMarketHeroProps {
  market: LiveMarketSummary | null;
}

interface EntrySnapshot {
  idx: number;
  name: string;
  family: string;
  probability: number;
  isWinner: boolean;
  color: string;
}

function formatAxisTime(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildChartRows(
  models: EntrySnapshot[],
  priceHistory: Record<string, Array<{ time: string; probability: number }>>
) {
  const rows = new Map<string, Record<string, string | number | null>>();

  for (const model of models) {
    const points = priceHistory[String(model.idx)] || [];
    for (const point of points) {
      if (!rows.has(point.time)) {
        rows.set(point.time, {
          time: point.time,
          label: formatAxisTime(point.time),
        });
      }
      rows.get(point.time)![`m_${model.idx}`] = point.probability;
    }
  }

  return Array.from(rows.values()).sort(
    (left, right) =>
      new Date(String(left.time)).getTime() - new Date(String(right.time)).getTime()
  );
}

export default function FeaturedMarketHero({ market }: FeaturedMarketHeroProps) {
  const [marketDetail, setMarketDetail] = useState<MarketDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!market) {
      return;
    }

    let active = true;

    const fetchMarketDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/markets/${market.internalId}`);
        const json = await res.json();
        if (!active || !res.ok || json.error) {
          return;
        }
        setMarketDetail(json);
      } catch (error) {
        console.error("Failed to fetch featured market detail:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchMarketDetail();
    const interval = window.setInterval(fetchMarketDetail, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [market]);

  const models = useMemo(() => {
    if (!market) {
      return [];
    }

    const detailedModels = parseModelsJson(marketDetail?.market.modelsJson).map((model) => ({
      idx: model.idx,
      name: model.modelName || model.fullName || `Model ${model.idx}`,
      family: model.familyName || "",
    }));

    return detailedModels.length > 0 ? detailedModels : market.models;
  }, [market, marketDetail?.market.modelsJson]);

  const isSettled =
    marketDetail?.market.status === 2 || market?.status === "settled";
  const winnerIdx =
    marketDetail?.market.winningModelIdx !== null &&
    marketDetail?.market.winningModelIdx !== undefined
      ? Number(marketDetail.market.winningModelIdx)
      : market?.winnerIdx;
  const marketTitle = marketDetail?.market.title || market?.title || "Market";
  const effectiveEndTime = marketDetail?.market.endTime || market?.endTime?.toString() || null;
  const latestProbabilityMap = new Map(
    (marketDetail?.latestPrices || []).map((price) => [price.modelIdx, price.probability])
  );

  const entrySnapshots = useMemo<EntrySnapshot[]>(() => {
    return models
      .map((model, index) => {
        const rawProbability = latestProbabilityMap.get(String(model.idx)) ?? null;
        const resolvedProbability =
          isSettled && winnerIdx !== undefined ? (winnerIdx === model.idx ? 100 : 0) : rawProbability ?? 0;
        return {
          idx: model.idx,
          name: model.name,
          family: model.family,
          probability: resolvedProbability,
          isWinner: winnerIdx === model.idx,
          color: MODEL_COLORS[index % MODEL_COLORS.length],
        };
      })
      .sort((left, right) => {
        if (left.isWinner !== right.isWinner) {
          return left.isWinner ? -1 : 1;
        }
        return right.probability - left.probability;
      });
  }, [isSettled, latestProbabilityMap, models, winnerIdx]);

  const isOutcome =
    market?.type === "outcome" ||
    (entrySnapshots.length === 2 &&
      entrySnapshots.some((entry) => entry.name.toUpperCase() === "YES") &&
      entrySnapshots.some((entry) => entry.name.toUpperCase() === "NO"));

  const yesEntry = entrySnapshots.find((entry) => entry.name.toUpperCase() === "YES");
  const noEntry = entrySnapshots.find((entry) => entry.name.toUpperCase() === "NO");
  const chartModels = isOutcome ? entrySnapshots.slice(0, 2) : entrySnapshots.slice(0, 4);
  const chartRows = buildChartRows(chartModels, marketDetail?.priceHistory || {});
  const leadingEntry = entrySnapshots[0];
  const winnerEntry = entrySnapshots.find((entry) => entry.isWinner) || leadingEntry;

  if (!market) {
    return (
      <div className="py-10 sm:py-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-cyan-300">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Market standby
        </div>
        <h2 className="mb-4 text-2xl font-bold leading-tight text-white sm:text-3xl">
          New market will be announced soon
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          There is no live Delphi market right now. As soon as the next market is created and the
          indexer picks it up, this panel will automatically switch to live pricing, trade flow,
          and recent transactions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://delphi.gensyn.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25"
          >
            Open Official Delphi
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] hover:bg-zinc-700"
          >
            Browse Market Archive
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="hero-card"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isSettled ? "badge-settled" : "badge-active"
            }`}
          >
            {isSettled ? "Settled" : "Live"}
          </span>
          <span className="font-mono text-sm text-zinc-500">Market #{market.displayId}</span>
        </div>
        {!isSettled && effectiveEndTime && (
          <div className="hidden sm:block">
            <CountdownTimer endTimestamp={effectiveEndTime} label="Ends in" />
          </div>
        )}
      </div>

      <h2 className="mb-6 text-xl font-bold leading-tight text-white sm:text-2xl lg:text-3xl">
        {marketTitle}
      </h2>

      {!isSettled && effectiveEndTime && (
        <div className="mb-5 inline-block rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-3 sm:hidden">
          <CountdownTimer endTimestamp={effectiveEndTime} label="Ends in" />
        </div>
      )}

      {isSettled ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-1 text-xs uppercase tracking-wider text-amber-400/70">
            Final Result
          </p>
          <p className="text-2xl font-bold text-amber-300">
            {winnerEntry?.name || "Winner not available"}
          </p>
        </div>
      ) : isOutcome && yesEntry && noEntry ? (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Current Odds
            </p>
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-400/80">Live market feed</span>
            </div>
          </div>
          <div className="mb-4 flex gap-3">
            {[yesEntry, noEntry].map((entry) => {
              const tone =
                entry.name.toUpperCase() === "YES"
                  ? "odds-pill odds-pill-yes text-emerald-400"
                  : "odds-pill odds-pill-no text-red-400";
              return (
                <div key={entry.idx} className={`${tone} flex-1`}>
                  <span className="text-xs font-medium uppercase tracking-wider text-current/70">
                    {entry.name}
                  </span>
                  <span className="font-mono text-3xl font-bold sm:text-4xl">
                    {entry.probability.toFixed(1)}
                    <span className="text-lg">%</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #10b981 0%, #10b981 ${yesEntry.probability}%, #ef4444 ${yesEntry.probability}%, #ef4444 100%)`,
              }}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Leading models
            </p>
            {leadingEntry && (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                Leader: {leadingEntry.family || leadingEntry.name}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {entrySnapshots.slice(0, 3).map((entry) => (
              <div
                key={entry.idx}
                className="rounded-xl border border-zinc-700/40 bg-zinc-900/55 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    {entry.family || `Model ${entry.idx}`}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
                <p className="mt-3 font-mono text-2xl font-bold text-cyan-300">
                  {entry.probability.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-zinc-700/30 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Price History
            </p>
            <p className="text-xs text-zinc-500">
              {isOutcome ? "YES/NO pricing" : "Live model pricing"} across the latest indexed window
            </p>
          </div>
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          )}
        </div>

        {chartRows.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartRows}>
              <CartesianGrid stroke="rgba(63,63,70,0.28)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(24,24,27,0.95)",
                  border: "1px solid rgba(63,63,70,0.5)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {chartModels.map((entry) => (
                <Line
                  key={entry.idx}
                  type="monotone"
                  dataKey={`m_${entry.idx}`}
                  stroke={entry.color}
                  strokeWidth={entry.isWinner ? 3 : 2}
                  dot={false}
                  connectNulls
                  animationDuration={900}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-zinc-500">
            Waiting for live price history...
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={`https://delphi.gensyn.ai/market/${market.internalId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25"
        >
          Trade Now
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        <Link
          href={`/markets/${market.internalId}`}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] hover:bg-zinc-700"
        >
          View Details
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}
