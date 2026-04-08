import Link from "next/link";
import prisma from "@/lib/prisma";
import { getLiveMarkets, type LiveMarketSummary } from "@/lib/live-markets";

export const dynamic = "force-dynamic";

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

export default async function MarketsPage() {
  const markets = await getLiveMarkets(prisma);
  const activeMarkets = markets.filter((market) => market.status === "active");
  const settledMarkets = markets.filter((market) => market.status === "settled");
  const totalMarkets = markets.length;
  const featuredHref = activeMarkets[0]
    ? `/markets/${activeMarkets[0].internalId}`
    : settledMarkets[0]
    ? `/markets/${settledMarkets[0].internalId}`
    : "/";

  return (
    <div className="page-shell mx-auto max-w-7xl px-4 py-8">
      <section className="page-hero mb-10">
        <span className="page-eyebrow">Market Intelligence</span>
        <div className="page-hero-header">
          <div className="max-w-3xl">
            <h1 className="page-title text-white">Markets</h1>
            <p className="page-description mt-4">
              Scan live opportunities, revisit settled benchmark rounds, and jump into the
              highest-signal Delphi markets with a cleaner research-style view.
            </p>
          </div>
          <Link href={featuredHref} className="hero-meta-pill">
            Open featured market
          </Link>
        </div>

        <div className="page-stat-grid">
          <div className="page-stat-card">
            <div className="page-stat-label">Total Markets</div>
            <div className="page-stat-value">{totalMarkets}</div>
            <div className="page-stat-caption">Full Delphi market archive</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">Live Opportunities</div>
            <div className="page-stat-value text-emerald-400">{activeMarkets.length}</div>
            <div className="page-stat-caption">Markets still taking trades</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">Settled Archive</div>
            <div className="page-stat-value text-blue-400">{settledMarkets.length}</div>
            <div className="page-stat-caption">Resolved markets with winners</div>
          </div>
          <div className="page-stat-card">
            <div className="page-stat-label">Network</div>
            <div className="page-stat-value text-cyan-400">Gensyn</div>
            <div className="page-stat-caption">Testnet analytics dashboard</div>
          </div>
        </div>
      </section>

      <div className="space-y-10">
        {activeMarkets.length > 0 && (
          <section className="section-panel">
            <div className="section-panel-header">
              <div className="section-panel-copy">
                <h2 className="text-xl font-semibold text-white">Active Markets</h2>
                <p>Open markets with current flow, pricing, and entry-level trade stats.</p>
              </div>
              <span className="badge-active rounded-full px-2 py-0.5 text-xs font-medium">
                {activeMarkets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeMarkets.map((market) => (
                <MarketCard key={market.internalId} market={market} />
              ))}
            </div>
          </section>
        )}

        {settledMarkets.length > 0 && (
          <section className="section-panel">
            <div className="section-panel-header">
              <div className="section-panel-copy">
                <h2 className="text-xl font-semibold text-white">Settled Markets</h2>
                <p>Resolved benchmark rounds and outcome markets with their final winner.</p>
              </div>
              <span className="badge-settled rounded-full px-2 py-0.5 text-xs font-medium">
                {settledMarkets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {settledMarkets.map((market) => (
                <MarketCard key={market.internalId} market={market} isSettled />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MarketCard({
  market,
  isSettled = false,
}: {
  market: LiveMarketSummary;
  isSettled?: boolean;
}) {
  const entryLabel = market.type === "outcome" ? "Outcomes" : "Models";
  const winnerLabel = market.type === "outcome" ? "Winning Outcome" : "Winner";

  return (
    <Link href={`/markets/${market.internalId}`} className="card glass-hover block p-5 card-hover">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 font-semibold text-white truncate">Market #{market.displayId}</h3>
          <p className="truncate text-sm text-zinc-400">{market.title}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            isSettled ? "badge-settled" : "badge-active"
          }`}
        >
          {isSettled ? "Settled" : "Active"}
        </span>
      </div>

      {isSettled && market.winnerName && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-1 text-xs text-amber-400/70">{winnerLabel}</p>
          <p className="truncate text-sm font-semibold text-amber-300">{market.winnerName}</p>
        </div>
      )}

      {market.models.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-zinc-500">
            {entryLabel} ({market.models.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {market.models.map((model) => {
              const isWinner = isSettled && market.winnerIdx === model.idx;
              return (
                <span
                  key={model.idx}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                    isWinner
                      ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {isWinner && <span>WIN</span>}
                  <span className="truncate max-w-[150px]">
                    {market.type === "outcome" ? model.name : model.family || model.name}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`grid gap-4 border-t border-[var(--border-color)] pt-4 ${
          isSettled ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">Trades</p>
          <p className="font-mono text-sm text-white">{market.totalTrades.toLocaleString()}</p>
        </div>
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">Volume</p>
          <p className="font-mono text-sm text-white">{formatVolume(market.totalVolume)}</p>
        </div>
        {isSettled && (
          <div>
            <p className="mb-0.5 text-xs text-zinc-500">Settled</p>
            <p className="text-xs text-zinc-400">{market.dateLabel || "-"}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
