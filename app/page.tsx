"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import { MARKETS, MarketConfig } from "@/lib/markets-config";
import FeaturedMarketHero from "@/components/FeaturedMarketHero";
import ScrollReveal from "@/components/ScrollReveal";

// Lazy load ParticleBackground for faster initial page load
const ParticleBackground = dynamic(
  () => import("@/components/ParticleBackground"),
  { ssr: false, loading: () => null }
);

interface HomeData {
  totalTrades: number;
  activeMarkets: number;
  settledMarkets: number;
  totalVolume: string;
  volume24h: string;
  trades24h: number;
  uniqueTraders: number;
  lastIndexedBlock: string;
  lastIndexedAt: string | null;
  recentTrades: Array<{
    id: string;
    trader: string;
    isBuy: boolean;
    tokensDelta: string;
    blockTime: string;
    marketId: string;
    modelIdx: string;
    impliedProbability: number;
  }>;
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (!json.error) {
          setData(json);
        }
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDisplayMarketId = (internalId: string): string => {
    const config = MARKETS[internalId];
    return config?.displayId || internalId;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ParticleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center z-10"
        >
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading Delphi Analytics...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <ParticleBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* FEATURED MARKET HERO */}
        <ScrollReveal>
          <section id="featured-market">
            <FeaturedMarketHero />
          </section>
        </ScrollReveal>

        {/* COMBINED STATS BAR */}
        {data && (
          <ScrollReveal delay={0.1}>
            <div className="stats-bar grid-lines grid-nodes grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" style={{ display: 'grid' }}>
              {[
                {
                  label: "24h Volume",
                  value: formatNumber(Number(data.volume24h || 0) / 1e18),
                  sub: `${(data.trades24h ?? 0).toLocaleString()} trades`,
                  color: "text-emerald-400",
                },
                {
                  label: "Active Markets",
                  value: data.activeMarkets ?? 0,
                  sub: `${data.settledMarkets ?? 0} settled`,
                  color: "text-blue-400",
                },
                {
                  label: "Unique Traders",
                  value: formatNumber(data.uniqueTraders ?? 0, 0),
                  sub: `${formatNumber(data.totalTrades ?? 0, 0)} total trades`,
                  color: "text-purple-400",
                },
                {
                  label: "Total Volume",
                  value: formatNumber(Number(data.totalVolume || 0) / 1e18),
                  sub: "$TEST all-time",
                  color: "text-cyan-400",
                },
                {
                  label: "Total Markets",
                  value: (data.activeMarkets ?? 0) + (data.settledMarkets ?? 0),
                  sub: "prediction markets",
                  color: "text-violet-400",
                },
              ].map((stat) => (
                <div key={stat.label} className="stats-bar-item">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">
                    {stat.label}
                  </p>
                  <p className={`text-xl sm:text-2xl font-bold font-mono ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* RECENT TRADES */}
        {data?.recentTrades && data.recentTrades.length > 0 && (
          <ScrollReveal delay={0.2}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">Recent Trades</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-zinc-500">Live</span>
                </div>
              </div>
              <Link
                href="/markets"
                className="text-sm text-zinc-500 hover:text-violet-400 transition-colors"
              >
                View all markets →
              </Link>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] sm:min-w-0">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                      <th className="px-3 sm:px-4 py-3 font-medium">Type</th>
                      <th className="px-3 sm:px-4 py-3 font-medium">Trader</th>
                      <th className="px-3 sm:px-4 py-3 font-medium">Market</th>
                      <th className="px-3 sm:px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">Price</th>
                      <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTrades.slice(0, 8).map((trade, idx) => {
                      const internalId = trade.marketId.toString();
                      const displayId = getDisplayMarketId(internalId);
                      return (
                        <motion.tr
                          key={trade.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
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
                            <Link
                              href={`/markets/${internalId}`}
                              className="text-xs sm:text-sm text-zinc-300 hover:text-blue-400 whitespace-nowrap"
                            >
                              Market #{displayId}
                            </Link>
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
                            <span className="text-xs text-zinc-500">
                              {formatTimeAgo(trade.blockTime)}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indexer Status */}
            <div className="mt-4 text-center">
              <p className="text-xs text-zinc-600">
                Last indexed block:{" "}
                <span className="font-mono text-zinc-500">{data?.lastIndexedBlock}</span>
                {data?.lastIndexedAt && (
                  <span className="ml-2">• Updated {formatTimeAgo(data.lastIndexedAt)}</span>
                )}
              </p>
            </div>
          </ScrollReveal>
        )}

        {/* ALWAYS-VISIBLE PLATFORM STATS */}
        <ScrollReveal delay={0.1}>
          <div className="stats-bar grid-lines grid-nodes" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              {
                label: "Total Markets",
                value: Object.keys(MARKETS).length.toString(),
                color: "#8b5cf6",
              },
              {
                label: "Active Markets",
                value: (Object.values(MARKETS) as MarketConfig[]).filter(m => m.status === "active").length.toString(),
                color: "#10b981",
              },
              {
                label: "Settled Markets",
                value: (Object.values(MARKETS) as MarketConfig[]).filter(m => m.status === "settled").length.toString(),
                color: "#3b82f6",
              },
              {
                label: "Network",
                value: "Gensyn",
                color: "#06b6d4",
              },
            ].map((stat, i) => (
              <div key={i} className="stats-bar-item">
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">{stat.label}</div>
                <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* ALL MARKETS OVERVIEW */}
        <ScrollReveal delay={0.15}>
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">All Markets</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium">
                  {Object.keys(MARKETS).length} markets
                </span>
              </div>
              <Link href="/markets" className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                View all
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.entries(MARKETS) as [string, typeof MARKETS[string]][]).map(([id, market], idx) => (
                <ScrollReveal key={id} delay={0.05 * idx}>
                  <Link
                    href={`/markets/market-${market.internalId}`}
                    className="card card-shimmer p-5 block group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-mono text-zinc-500">#{market.displayId}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        market.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      }`}>
                        {market.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        {market.status === "active" ? "Live" : "Settled"}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white leading-snug mb-3 group-hover:text-violet-300 transition-colors line-clamp-2">
                      {market.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {market.endDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {market.models.length} {market.type === "model" ? "models" : "outcomes"}
                      </span>
                      {market.winnerIdx !== undefined && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Resolved
                        </span>
                      )}
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* WHY DELPHI — FEATURES */}
        <ScrollReveal delay={0.2}>
          <section>
            <h2 className="text-xl font-bold text-white mb-6 text-center">Why Delphi Analytics?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: "📊",
                  title: "Real-Time Charts",
                  desc: "Live price data with minute-by-minute updates from Delphi's prediction markets.",
                },
                {
                  icon: "🔮",
                  title: "Live Odds",
                  desc: "See current YES/NO probabilities and track how they shift over time.",
                },
                {
                  icon: "🏆",
                  title: "Leaderboard",
                  desc: "Track top traders, biggest wins, and P&L across all markets.",
                },
                {
                  icon: "⛓️",
                  title: "On-Chain Data",
                  desc: "Every trade indexed from the Gensyn testnet blockchain — fully transparent.",
                },
              ].map((feature, i) => (
                <ScrollReveal key={i} delay={0.05 * i}>
                  <div className="card p-5 text-center group">
                    <div className="text-3xl mb-3">{feature.icon}</div>
                    <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* CTA SECTION */}
        <ScrollReveal delay={0.25}>
          <section className="text-center py-8">
            <h2 className="text-2xl font-bold text-white mb-2">Ready to trade?</h2>
            <p className="text-zinc-500 text-sm mb-6 max-w-md mx-auto">
              Delphi prediction markets are live on Gensyn Testnet. Place your bets on AI model outcomes.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="https://delphi.gensyn.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all"
              >
                Start Trading
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold transition-all"
              >
                View Leaderboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>
        </ScrollReveal>

        {/* FOOTER */}
        <section className="pt-8 border-t border-zinc-800/50">
          <div className="text-center">
            <p className="text-zinc-600 text-sm">
              Built with &hearts; for the{" "}
              <a
                href="https://gensyn.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                Gensyn
              </a>{" "}
              community
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
