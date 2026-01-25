"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatTokens, formatAddress, formatDate, formatTimeAgo, parseModelsJson } from "@/lib/utils";
import { LINKS, MODEL_COLORS } from "@/lib/constants";
import StatCard from "@/components/ui/StatCard";
import PriceChart from "@/components/charts/PriceChart";

interface MarketData {
  market: {
    marketId: string;
    title: string;
    description: string;
    category: string;
    configUri: string;
    status: number;
    statusLabel: string;
    winningModelIdx: string | null;
    createdAt: string;
    endTime: string;
    settledAt: string;
    totalTrades: number;
    totalVolume: string;
    modelsJson: any;
  };
  latestPrices: Array<{
    modelIdx: string;
    price: string;
    probability: number;
  }>;
  priceHistory: Record<string, Array<{ time: string; probability: number }>>;
  recentTrades: Array<{
    id: string;
    txHash: string;
    trader: string;
    isBuy: boolean;
    modelIdx: string;
    tokensDelta: string;
    sharesDelta: string;
    impliedProbability: number;
    blockTime: string;
  }>;
}

export default function MarketDetailPage() {
  const { marketId } = useParams();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/markets/${marketId}`);
        if (!res.ok) throw new Error("Market not found");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    if (marketId) fetchData();
  }, [marketId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-12 text-center">
          <p className="text-red-400 text-lg">{error || "Market not found"}</p>
          <Link href="/markets" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const { market, latestPrices, priceHistory, recentTrades } = data;
  const models = parseModelsJson(market.modelsJson);
  const isActive = market.status === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <Link href="/markets" className="text-sm text-zinc-500 hover:text-zinc-300 mb-2 inline-block">
              ← Markets
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {market.title || `Market #${market.marketId}`}
            </h1>
          </div>
          <span className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${
            isActive ? "badge-active" : "badge-settled"
          }`}>
            {market.statusLabel}
          </span>
        </div>
        {market.description && (
          <p className="text-zinc-400 mt-2 max-w-3xl">{market.description}</p>
        )}
        {market.category && (
          <span className="inline-block mt-2 text-xs text-zinc-500 uppercase tracking-wider">
            {market.category}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Trades"
          value={market.totalTrades}
          color="blue"
        />
        <StatCard
          title="Volume"
          value={formatTokens(market.totalVolume)}
          subtitle="$TEST"
          color="green"
        />
        <StatCard
          title={isActive ? "Ends" : "Settled"}
          value={
            isActive && market.endTime 
              ? formatDate(market.endTime).split(",")[0]
              : market.settledAt 
                ? formatDate(market.settledAt).split(",")[0]
                : "—"
          }
          color={isActive ? "orange" : "purple"}
        />
        <StatCard
          title="Models"
          value={models.length || latestPrices.length}
          color="cyan"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Chart */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Win Probability</h2>
            {Object.keys(priceHistory).length > 0 ? (
              <PriceChart 
                priceHistory={priceHistory} 
                modelsJson={market.modelsJson}
                height={350}
              />
            ) : (
              <div className="h-[350px] flex items-center justify-center text-zinc-500">
                No price history available yet
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-white">Recent Trades</h2>
            </div>
            {recentTrades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Trader</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Price</th>
                      <th className="px-4 py-3 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => {
                      const model = models.find((m) => m.idx.toString() === trade.modelIdx);
                      return (
                        <tr key={trade.id} className="table-row border-b border-[var(--border-color)] last:border-0">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              trade.isBuy 
                                ? "bg-emerald-500/10 text-emerald-400" 
                                : "bg-red-500/10 text-red-400"
                            }`}>
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
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: model?.color || MODEL_COLORS[parseInt(trade.modelIdx) % MODEL_COLORS.length] }}
                              />
                              <span className="text-sm text-zinc-300 truncate max-w-[150px]">
                                {model?.fullName || `Model ${trade.modelIdx}`}
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
                              {trade.impliedProbability?.toFixed(1) || "0"}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={LINKS.tx(trade.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-500 hover:text-zinc-300"
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
              <div className="p-8 text-center text-zinc-500">
                No trades yet
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Models */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Top Entrants</h2>
            <div className="space-y-3">
              {latestPrices
                .sort((a, b) => (b.probability || 0) - (a.probability || 0))
                .map((price, i) => {
                  const model = models.find((m) => m.idx.toString() === price.modelIdx);
                  const isWinner = market.winningModelIdx === price.modelIdx;
                  
                  return (
                    <div 
                      key={price.modelIdx}
                      className={`p-3 rounded-lg border ${
                        isWinner 
                          ? "bg-amber-500/10 border-amber-500/30" 
                          : "bg-[var(--bg-secondary)] border-[var(--border-color)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                          i === 0 ? "bg-amber-500 text-black" :
                          i === 1 ? "bg-zinc-400 text-black" :
                          i === 2 ? "bg-amber-700 text-white" :
                          "bg-zinc-700 text-zinc-400"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: model?.color || MODEL_COLORS[i % MODEL_COLORS.length] }}
                            />
                            <span className="font-medium text-white text-sm truncate">
                              {model?.fullName || `Model ${price.modelIdx}`}
                            </span>
                            {isWinner && <span className="text-amber-400">🏆</span>}
                          </div>
                          {model?.commitHash && (
                            <p className="font-mono text-[10px] text-zinc-600 truncate">
                              {model.commitHash.slice(0, 8)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500">Last Price</p>
                          <p className="font-mono text-sm font-medium text-white">
                            {price.probability?.toFixed(1) || "0"}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* External Links */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Links</h2>
            <div className="space-y-2">
              <a
                href={`https://delphi.gensyn.ai/market/${market.marketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm text-zinc-300">Trade on Delphi</span>
                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {market.configUri && (
                <a
                  href={market.configUri.startsWith("ipfs://") 
                    ? `https://ipfs.io/ipfs/${market.configUri.slice(7)}`
                    : market.configUri
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-sm text-zinc-300">View Metadata</span>
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
