import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber, formatTokens, formatDate, parseModelsJson } from "@/lib/utils";
import { MARKET_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function getMarkets() {
  try {
    const markets = await prisma.market.findMany({
      orderBy: [
        { status: "asc" }, // Active first
        { createdAtTime: "desc" },
      ],
      include: {
        _count: { select: { trades: true } },
      },
    });
    return markets;
  } catch (e) {
    console.error("Markets fetch error:", e);
    return [];
  }
}

export default async function MarketsPage() {
  const markets = await getMarkets();
  
  const activeMarkets = markets.filter((m) => m.status === MARKET_STATUS.ACTIVE);
  const settledMarkets = markets.filter((m) => m.status === MARKET_STATUS.SETTLED);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Markets</h1>
        <p className="text-zinc-400">All Delphi prediction markets on Gensyn Testnet</p>
      </div>

      {markets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-400 text-lg">No markets found. The indexer may still be syncing.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active Markets */}
          {activeMarkets.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold text-white">Active Markets</h2>
                <span className="badge-active px-2 py-0.5 rounded-full text-xs font-medium">
                  {activeMarkets.length}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeMarkets.map((market) => (
                  <MarketCard key={market.marketId.toString()} market={market} />
                ))}
              </div>
            </section>
          )}

          {/* Settled Markets */}
          {settledMarkets.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold text-white">Settled Markets</h2>
                <span className="badge-settled px-2 py-0.5 rounded-full text-xs font-medium">
                  {settledMarkets.length}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {settledMarkets.map((market) => (
                  <MarketCard key={market.marketId.toString()} market={market} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MarketCard({ market }: { market: any }) {
  const models = parseModelsJson(market.modelsJson);
  const isActive = market.status === MARKET_STATUS.ACTIVE;
  const winnerIdx = market.winningModelIdx?.toString();
  const winner = models.find((m) => m.idx.toString() === winnerIdx);

  return (
    <Link 
      href={`/markets/${market.marketId}`}
      className="card p-5 card-hover block"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate mb-1">
            {market.title || `Market #${market.marketId}`}
          </h3>
          {market.category && (
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {market.category}
            </span>
          )}
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
          isActive ? "badge-active" : "badge-settled"
        }`}>
          {isActive ? "Active" : "Settled"}
        </span>
      </div>

      {/* Models list */}
      {models.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">Models</p>
          <div className="flex flex-wrap gap-1.5">
            {models.slice(0, 5).map((model) => {
              const isWinner = winnerIdx && model.idx.toString() === winnerIdx;
              return (
                <span 
                  key={model.idx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    isWinner 
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {isWinner && <span>🏆</span>}
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: model.color }}
                  />
                  <span className="truncate max-w-[120px]">{model.fullName}</span>
                </span>
              );
            })}
            {models.length > 5 && (
              <span className="px-2 py-0.5 text-xs text-zinc-500">
                +{models.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border-color)]">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Trades</p>
          <p className="font-mono text-sm text-white">{market._count.trades}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Volume</p>
          <p className="font-mono text-sm text-white">{formatTokens(market.totalVolume || "0")}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">
            {isActive ? "Ends" : "Settled"}
          </p>
          <p className="text-xs text-zinc-400">
            {market.endTime 
              ? formatDate(market.endTime).split(",")[0]
              : market.settledAt 
                ? formatDate(market.settledAt).split(",")[0]
                : "—"
            }
          </p>
        </div>
      </div>
    </Link>
  );
}
