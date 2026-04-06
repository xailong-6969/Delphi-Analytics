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
import { formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
import { MARKETS, VALID_MARKET_IDS, getMarketConfig } from "@/lib/markets-config";
import CountdownTimer from "@/components/CountdownTimer";
import ScrollReveal from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";

const MODEL_COLORS = [
  "#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#84CC16",
];

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

interface Trade {
  id: string;
  trader: string;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
  modelIdx: string;
  blockTime: string;
  txHash: string;
  impliedProbability: number;
}

interface TradesResponse {
  trades: Trade[];
  totalTrades: number;
  totalVolume: string;
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

function formatVolume(vol: string): string {
  try {
    const num = Number(BigInt(vol)) / 1e18;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toFixed(2);
  } catch {
    return "0.00";
  }
}

function parseChartPoints(data: DelphiChartResponse): ChartDataPoint[] {
  if (!data.data_points) return [];
  return data.data_points.map((dp) => {
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

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

interface PageProps {
  params: { marketId: string };
}

export default function MarketDetailPage({ params }: PageProps) {
  const { marketId: internalId } = params;
  const config = getMarketConfig(internalId);

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [liveOdds, setLiveOdds] = useState<{ yes: number; no: number } | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [tradesData, setTradesData] = useState<TradesResponse | null>(null);
  const [tradesLoading, setTradesLoading] = useState(true);

  // Validate market ID
  if (!VALID_MARKET_IDS.includes(internalId) || !config) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-12 text-center">
          <p className="text-red-400 text-lg mb-4">Market not found</p>
          <Link href="/markets" className="text-blue-400 hover:underline">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const isSettled = config.status === "settled";
  const isActive = config.status === "active";
  const isOutcome = config.type === "outcome";
  const entryLabel = isOutcome ? "Outcomes" : "Models";
  const winnerLabel = isOutcome ? "Winning Outcome" : "Winner";
  const winnerModel = config.winnerIdx !== undefined
    ? config.models.find((m) => m.idx === config.winnerIdx)
    : undefined;

  // Current odds from live data
  const currentOdds = useMemo(() => {
    if (liveOdds) return liveOdds;
    if (chartData.length === 0) return { yes: 50, no: 50 };
    const latest = chartData[chartData.length - 1];
    return {
      yes: Math.round(latest.yesPrice * 1000) / 10,
      no: Math.round(latest.noPrice * 1000) / 10,
    };
  }, [liveOdds, chartData]);

  // Fetch chart data + live odds
  useEffect(() => {
    async function fetchChartData() {
      try {
        const [liveRes, chartRes] = await Promise.all([
          fetch(`/api/markets/${internalId}/chart?timeframe=1h`),
          fetch(`/api/markets/${internalId}/chart?timeframe=auto`),
        ]);

        const [liveData, chartRespData]: [DelphiChartResponse, DelphiChartResponse] =
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

        const points = parseChartPoints(chartRespData);
        if (points.length) setChartData(points);
      } catch (e) {
        console.error("Failed to fetch chart data:", e);
      } finally {
        setChartLoading(false);
      }
    }

    fetchChartData();
    const interval = setInterval(fetchChartData, 30000);
    return () => clearInterval(interval);
  }, [internalId]);

  // Fetch trades data
  useEffect(() => {
    async function fetchTrades() {
      try {
        const res = await fetch(`/api/markets/${internalId}/trades`);
        const json = await res.json();
        if (!json.error) {
          setTradesData(json);
        }
      } catch (e) {
        console.error("Failed to fetch trades:", e);
      } finally {
        setTradesLoading(false);
      }
    }

    fetchTrades();
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, [internalId]);

  return (
    <motion.div
      className="mx-auto max-w-6xl px-4 py-8 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* HEADER */}
      <motion.div variants={itemVariants}>
        <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Markets
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Market #{config.displayId}</h1>
              <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
                isSettled ? "badge-settled" : "badge-active"
              }`}>
                {isSettled ? "Settled" : isActive ? "🟢 Live" : "Active"}
              </span>
            </div>
            <p className="text-zinc-400 text-sm sm:text-base">{config.title}</p>
          </div>
          {isActive && config.endTimestamp && (
            <div className="hidden sm:block shrink-0">
              <CountdownTimer endTimestamp={config.endTimestamp} label="Ends in" />
            </div>
          )}
        </div>
        {/* Mobile countdown */}
        {isActive && config.endTimestamp && (
          <div className="sm:hidden mt-4 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 inline-block">
            <CountdownTimer endTimestamp={config.endTimestamp} label="Ends in" />
          </div>
        )}
      </motion.div>

      {/* WINNER BANNER (settled) */}
      {isSettled && winnerModel && (
        <motion.div
          variants={itemVariants}
          className="card p-6 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/30"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <p className="text-sm text-amber-400/70 mb-1">{winnerLabel}</p>
              <p className="text-xl font-bold text-amber-300">{winnerModel.name}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* LIVE ODDS (active/outcome markets) */}
      {isOutcome && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              {isActive ? "Current Odds" : "Final Odds"}
            </p>
            {isActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-400/80 font-medium">Updates every ~1 min</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mb-4">
            {/* YES pill */}
            <div className="odds-pill odds-pill-yes flex-1">
              <span className="text-xs text-emerald-400/70 uppercase tracking-wider font-medium">Yes</span>
              <span className="text-3xl sm:text-4xl font-bold font-mono text-emerald-400">
                {currentOdds.yes}<span className="text-lg">%</span>
              </span>
            </div>
            {/* NO pill */}
            <div className="odds-pill odds-pill-no flex-1">
              <span className="text-xs text-red-400/70 uppercase tracking-wider font-medium">No</span>
              <span className="text-3xl sm:text-4xl font-bold font-mono text-red-400">
                {currentOdds.no}<span className="text-lg">%</span>
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
        </motion.div>
      )}

      {/* PRICE CHARTS */}
      {isOutcome && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* YES Chart */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">YES Price</span>
              </div>
              <span className="text-sm font-mono font-bold text-emerald-400">{currentOdds.yes}%</span>
            </div>
            {chartLoading ? (
              <div className="w-full flex items-center justify-center" style={{ height: 180 }}>
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`yesGrad-${internalId}`} x1="0" y1="0" x2="0" y2="1">
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
                    labelFormatter={(ts: number) => formatTooltipTime(ts)}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "YES"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="yesPrice"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill={`url(#yesGrad-${internalId})`}
                    dot={false}
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full flex items-center justify-center text-zinc-600 text-sm" style={{ height: 180 }}>
                No chart data
              </div>
            )}
          </div>

          {/* NO Chart */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">NO Price</span>
              </div>
              <span className="text-sm font-mono font-bold text-red-400">{currentOdds.no}%</span>
            </div>
            {chartLoading ? (
              <div className="w-full flex items-center justify-center" style={{ height: 180 }}>
                <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`noGrad-${internalId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
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
                    labelFormatter={(ts: number) => formatTooltipTime(ts)}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "NO"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="noPrice"
                    stroke="#f87171"
                    strokeWidth={2}
                    fill={`url(#noGrad-${internalId})`}
                    dot={false}
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full flex items-center justify-center text-zinc-600 text-sm" style={{ height: 180 }}>
                No chart data
              </div>
            )}
          </div>
        </motion.div>
      )}

      {isOutcome && chartData.length > 0 && (
        <p className="text-[10px] text-zinc-600 text-center -mt-4">
          Implied pricing · Last 3 days · Updates every ~1 min
        </p>
      )}

      {/* STATS ROW */}
      <motion.div variants={itemVariants}>
        <div className="stats-bar grid-cols-2 sm:grid-cols-4" style={{ display: "grid" }}>
          <div className="stats-bar-item">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">Total Trades</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-blue-400">
              {tradesData ? tradesData.totalTrades.toLocaleString() : "—"}
            </p>
          </div>
          <div className="stats-bar-item">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">Volume</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              {tradesData ? formatVolume(tradesData.totalVolume) : "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">$TEST</p>
          </div>
          <div className="stats-bar-item">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">
              {isSettled ? "Settled" : "Ends"}
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-purple-400">
              {config.endDate || "—"}
            </p>
          </div>
          <div className="stats-bar-item">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">{entryLabel}</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-cyan-400">
              {config.models.length}
            </p>
          </div>
        </div>
      </motion.div>

      {/* MODELS / OUTCOMES LIST */}
      {!isOutcome && (
        <motion.div variants={itemVariants} className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{entryLabel}</h2>
          <div className="space-y-3">
            {config.models.map((model) => {
              const isWinner = isSettled && config.winnerIdx === model.idx;
              return (
                <motion.div
                  key={model.idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: model.idx * 0.05 }}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    isWinner
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-zinc-800/50 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: MODEL_COLORS[model.idx % MODEL_COLORS.length] }}
                    />
                    <span className="text-zinc-400 font-mono text-sm">#{model.idx}</span>
                    <span className={`font-medium ${isWinner ? "text-amber-300" : "text-white"}`}>
                      {model.name}
                    </span>
                    {isWinner && <span className="text-amber-400">🏆</span>}
                  </div>
                  <span className="text-sm text-zinc-500">{model.family}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* RECENT TRADES */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Recent Trades</h2>
            {isActive && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-500">Live</span>
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          {tradesLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-zinc-400 mt-4 text-sm">Loading trades...</p>
            </div>
          ) : tradesData?.trades && tradesData.trades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] sm:min-w-0">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                    <th className="px-3 sm:px-4 py-3 font-medium">Type</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Trader</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">{isOutcome ? "Outcome" : "Model"}</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">Price</th>
                    <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesData.trades.map((trade, idx) => {
                    const modelInfo = config.models.find((m) => m.idx === Number(trade.modelIdx));
                    const modelName = modelInfo?.name || `Model ${trade.modelIdx}`;
                    return (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="table-row border-b border-[var(--border-color)] last:border-0"
                      >
                        <td className="px-3 sm:px-4 py-3">
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
                        <td className="px-3 sm:px-4 py-3">
                          <Link
                            href={`/address/${trade.trader}`}
                            className="font-mono text-xs sm:text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                          >
                            {formatAddress(trade.trader, 4)}
                          </Link>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: MODEL_COLORS[Number(trade.modelIdx) % MODEL_COLORS.length] }}
                            />
                            <span className="text-xs sm:text-sm text-zinc-300 truncate max-w-[130px]">
                              {modelName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <span className="font-mono text-xs sm:text-sm text-white">
                            {formatTokens(trade.tokensDelta)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">
                          <span className="font-mono text-sm text-zinc-400">
                            {trade.impliedProbability?.toFixed(1) || "0"}%
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                          <a
                            href={LINKS.tx(trade.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {formatTimeAgo(trade.blockTime)}
                          </a>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">No trades yet</div>
          )}
        </div>
      </motion.div>

      {/* LINKS */}
      <motion.div variants={itemVariants} className="card card-shimmer p-6">
        <h2 className="font-semibold text-white mb-4">Links</h2>
        <div className="flex flex-wrap gap-3">
          <MagneticButton
            href={`https://delphi.gensyn.ai/market/${internalId}`}
            external
            variant="primary"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            }
          >
            Trade on Delphi
          </MagneticButton>
          <MagneticButton
            href={LINKS.contract}
            external
            variant="secondary"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            }
          >
            View Contract
          </MagneticButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
