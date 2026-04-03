"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import CountdownTimer from "@/components/CountdownTimer";
import { MARKETS, MarketConfig } from "@/lib/markets-config";

interface ChartDataPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  label: string;
}

interface DelphiChartResponse {
  market_id: string;
  timeframe: string;
  resolution: string;
  data_points: Array<{
    timestamp: number;
    entries: Array<{
      entry_idx: string;
      price: string;
      shares: string;
    }>;
  }>;
}

function getActiveMarket(): MarketConfig | null {
  for (const market of Object.values(MARKETS)) {
    if (market.status === "active") return market;
  }
  return null;
}

function getMostRecentSettledMarket(): MarketConfig | null {
  const settled = Object.values(MARKETS)
    .filter((m) => m.status === "settled")
    .sort((a, b) => parseInt(b.displayId) - parseInt(a.displayId));
  return settled[0] || null;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="chart-tooltip">
      <p className="text-xs text-zinc-400 mb-1">{formatTooltipTime(data.timestamp)}</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-mono font-semibold">
            YES {(data.yesPrice * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs text-red-400 font-mono font-semibold">
            NO {(data.noPrice * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FeaturedMarketHero() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [liveOdds, setLiveOdds] = useState<{ yes: number; no: number } | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const activeMarket = useMemo(() => getActiveMarket(), []);
  const fallbackMarket = useMemo(() => getMostRecentSettledMarket(), []);
  const market = activeMarket || fallbackMarket;
  const isActive = !!activeMarket;

  // Current odds from live data (1h endpoint with 60s candles)
  const currentOdds = useMemo(() => {
    if (liveOdds) return liveOdds;
    if (chartData.length === 0) return { yes: 50, no: 50 };
    const latest = chartData[chartData.length - 1];
    return {
      yes: Math.round(latest.yesPrice * 1000) / 10,
      no: Math.round(latest.noPrice * 1000) / 10,
    };
  }, [liveOdds, chartData]);

  function parseChartPoints(data: DelphiChartResponse): ChartDataPoint[] {
    if (!data.data_points) return [];
    return data.data_points.map((dp) => {
      // Chart API: entry_idx "0" = YES, entry_idx "1" = NO
      // (reversed from market config where idx 0 = NO, idx 1 = YES)
      const yesEntry = dp.entries.find((e) => e.entry_idx === "0");
      const noEntry = dp.entries.find((e) => e.entry_idx === "1");
      return {
        timestamp: dp.timestamp,
        yesPrice: parseFloat(yesEntry?.price || "0.5"),
        noPrice: parseFloat(noEntry?.price || "0.5"),
        label: formatTimestamp(dp.timestamp),
      };
    });
  }

  useEffect(() => {
    if (!market) return;

    async function fetchData() {
      try {
        // Fetch both: 1h (60s candles) for live odds, auto/3d for full chart
        const [liveRes, chartRes] = await Promise.all([
          fetch(`/api/markets/${market!.internalId}/chart?timeframe=1h`),
          fetch(`/api/markets/${market!.internalId}/chart?timeframe=auto`),
        ]);

        const [liveData, chartData]: [DelphiChartResponse, DelphiChartResponse] =
          await Promise.all([liveRes.json(), chartRes.json()]);

        // Live odds from the latest 60s candle
        if (liveData.data_points?.length) {
          const latest = liveData.data_points[liveData.data_points.length - 1];
          const yesEntry = latest.entries.find((e) => e.entry_idx === "0");
          const noEntry = latest.entries.find((e) => e.entry_idx === "1");
          setLiveOdds({
            yes: Math.round(parseFloat(yesEntry?.price || "0.5") * 1000) / 10,
            no: Math.round(parseFloat(noEntry?.price || "0.5") * 1000) / 10,
          });
        }

        // Chart data from 1d (hourly candles)
        const points = parseChartPoints(chartData);
        if (points.length) setChartData(points);
      } catch (e) {
        console.error("Failed to fetch market data:", e);
      } finally {
        setChartLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [market]);

  if (!market) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-500">No markets available</p>
      </div>
    );
  }

  const winnerModel =
    !isActive && market.winnerIdx !== undefined
      ? market.models.find((m) => m.idx === market.winnerIdx)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="hero-card"
    >
      {/* Status + Market ID header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
              isActive ? "badge-active" : "badge-settled"
            }`}
          >
            {isActive ? "🟢 Live" : "Settled"}
          </span>
          <span className="text-sm text-zinc-500 font-mono">
            Market #{market.displayId}
          </span>
        </div>
        {isActive && market.endTimestamp && (
          <div className="hidden sm:block">
            <CountdownTimer
              endTimestamp={market.endTimestamp}
              label="Ends in"
            />
          </div>
        )}
      </div>

      {/* Market Question */}
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-6 leading-tight">
        {market.title}
      </h2>

      {/* Mobile countdown */}
      {isActive && market.endTimestamp && (
        <div className="sm:hidden mb-5 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 inline-block">
          <CountdownTimer endTimestamp={market.endTimestamp} label="Ends in" />
        </div>
      )}

      {/* Odds Display */}
      <div className="mb-6">
        {isActive ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                Current Odds
              </p>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-400/80 font-medium">Updates every ~1 min</span>
              </div>
            </div>
            <div className="flex gap-3 mb-4">
              {/* YES pill */}
              <div className="odds-pill odds-pill-yes flex-1">
                <span className="text-xs text-emerald-400/70 uppercase tracking-wider font-medium">
                  Yes
                </span>
                <span className="text-3xl sm:text-4xl font-bold font-mono text-emerald-400">
                  {currentOdds.yes}
                  <span className="text-lg">%</span>
                </span>
              </div>
              {/* NO pill */}
              <div className="odds-pill odds-pill-no flex-1">
                <span className="text-xs text-red-400/70 uppercase tracking-wider font-medium">
                  No
                </span>
                <span className="text-3xl sm:text-4xl font-bold font-mono text-red-400">
                  {currentOdds.no}
                  <span className="text-lg">%</span>
                </span>
              </div>
            </div>

            {/* Odds bar */}
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, #10b981 0%, #10b981 ${currentOdds.yes}%, #ef4444 ${currentOdds.yes}%, #ef4444 100%)`,
                }}
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </>
        ) : (
          /* Settled market: show winner */
          <>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-medium">
              Result
            </p>
            {winnerModel && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <p className="text-xs text-amber-400/70 mb-0.5">
                      Winning Outcome
                    </p>
                    <p className="text-2xl font-bold text-amber-300">
                      {winnerModel.name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Two separate charts — NO and YES side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* NO Chart */}
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">NO Price</span>
            </div>
            {chartData.length > 0 && (
              <span className="text-sm font-mono font-bold text-emerald-400">
                {(chartData[chartData.length - 1].noPrice * 100).toFixed(1)}%
              </span>
            )}
          </div>
          {chartLoading ? (
            <div className="w-full flex items-center justify-center" style={{ height: 180 }}>
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="noGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 10, fill: "#3f3f46" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "#3f3f46" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(24,24,27,0.95)",
                    border: "1px solid rgba(63,63,70,0.5)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(ts: number) => formatTimestamp(ts)}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "NO"]}
                />
                <Area
                  type="monotone"
                  dataKey="noPrice"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#noGrad)"
                  dot={false}
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full flex items-center justify-center text-zinc-600 text-sm" style={{ height: 180 }}>
              No data
            </div>
          )}
        </div>

        {/* YES Chart */}
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">YES Price</span>
            </div>
            {chartData.length > 0 && (
              <span className="text-sm font-mono font-bold text-violet-400">
                {(chartData[chartData.length - 1].yesPrice * 100).toFixed(1)}%
              </span>
            )}
          </div>
          {chartLoading ? (
            <div className="w-full flex items-center justify-center" style={{ height: 180 }}>
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 10, fill: "#3f3f46" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "#3f3f46" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(24,24,27,0.95)",
                    border: "1px solid rgba(63,63,70,0.5)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(ts: number) => formatTimestamp(ts)}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "YES"]}
                />
                <Area
                  type="monotone"
                  dataKey="yesPrice"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#yesGrad)"
                  dot={false}
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full flex items-center justify-center text-zinc-600 text-sm" style={{ height: 180 }}>
              No data
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-zinc-600 text-center -mt-4 mb-6">
        Implied pricing · Last 3 days · Updates every ~1 min
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://delphi.gensyn.ai/market/${market.internalId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-violet-500/25"
        >
          Trade Now
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all hover:scale-[1.03] border border-zinc-700"
        >
          View Details
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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
