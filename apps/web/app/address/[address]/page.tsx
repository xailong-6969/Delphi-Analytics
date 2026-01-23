"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AddressDashboard() {
  const { address } = useParams();
  const [data, setData] = useState<any>({ stats: null, pnl: null, trades: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      try {
        const [statsRes, pnlRes, tradesRes] = await Promise.all([
          fetch(`/api/address/${address}/stats`),
          fetch(`/api/address/${address}/pnl`),
          fetch(`/api/address/${address}/trades?take=20`)
        ]);

        const [stats, pnl, tradesData] = await Promise.all([
          statsRes.json(),
          pnlRes.json(),
          tradesRes.json()
        ]);

        setData({ stats, pnl, trades: tradesData.trades || [] });
      } catch (e) {
        console.error("Data fetch failed", e);
      } finally {
        setLoading(false);
      }
    }
    if (address) fetchAllData();
  }, [address]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="animate-pulse text-lg font-medium text-neutral-400">Loading wallet analytics...</div>
      </div>
    );
  }

  const { stats, pnl, trades } = data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header Section */}
      <div className="border-b border-neutral-800 pb-6">
        <h1 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">Wallet Address</h1>
        <p className="text-2xl font-mono font-bold text-white break-all">{address}</p>
      </div>

      {/* Stats and PnL Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total P&L" value={formatBalance(pnl?.totals?.totalPnl)} color="text-blue-400" />
        <StatCard title="Realized P&L" value={formatBalance(pnl?.totals?.realizedPnl)} />
        <StatCard title="Unrealized P&L" value={formatBalance(pnl?.totals?.unrealizedPnl)} />
        <StatCard title="Total Trades" value={stats?.totalTrades || 0} />
      </div>

      {/* Detailed Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-white">Recent Trades</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/30">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Market:Model</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Implied %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {trades.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                    <td className={`px-4 py-3 font-bold ${t.isBuy ? 'text-green-500' : 'text-red-500'}`}>
                      {t.isBuy ? 'BUY' : 'SELL'}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 font-mono">
                      {t.marketId}:{t.modelIdx}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {Number(BigInt(t.tokensDelta) / 10n**15n) / 1000} $TEST
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-400">
                      {t.impliedPct?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Portfolio Overview</h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-neutral-400">Open Positions</span>
              <span className="text-white font-bold">{pnl?.totals?.openPositions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Buy Volume</span>
              <span className="text-white font-mono">{formatBalance(stats?.buyTokens)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-800 pt-4">
              <span className="text-neutral-400">Net Flow Proxy</span>
              <span className="text-blue-400 font-bold font-mono">{formatBalance(stats?.netTokensProxy)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, color = "text-white" }: { title: string, value: any, color?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function formatBalance(val: string | undefined) {
  if (!val) return "0.00";
  // Assuming 18 decimals for testnet tokens
  return (Number(BigInt(val) / 10n**15n) / 1000).toLocaleString(undefined, { minimumFractionDigits: 2 });
}
