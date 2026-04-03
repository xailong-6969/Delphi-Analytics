"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import { MARKETS } from "@/lib/markets-config";
import FeaturedMarketHero from "@/components/FeaturedMarketHero";

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
        <section id="featured-market">
          <FeaturedMarketHero />
        </section>

        {/* COMBINED STATS BAR */}
        {data && (
          <motion.section
            id="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="stats-bar grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" style={{ display: 'grid' }}>
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
          </motion.section>
        )}

        {/* RECENT TRADES */}
        {data?.recentTrades && data.recentTrades.length > 0 && (
          <motion.section
            id="recent-trades"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
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
          </motion.section>
        )}

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
