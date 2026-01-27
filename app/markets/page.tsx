import Link from "next/link";
import prisma from "@/lib/prisma";
import { MARKETS, VALID_MARKET_IDS_BIGINT } from "@/lib/markets-config";

export const dynamic = "force-dynamic";

const MODEL_COLORS = [
  "#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#84CC16",
];

async function getMarketsData() {
  try {
    // Get trade counts and volumes from database
    const dbMarkets = await prisma.market.findMany({
      where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
      include: { _count: { select: { trades: true } } },
    });

    const dbDataMap = new Map(
      dbMarkets.map(m => [m.marketId.toString(), {
        totalTrades: m._count.trades,
        totalVolume: m.totalVolume?.toString() || "0",
        settledAt: m.settledAt,
      }])
    );

    const activeMarkets: any[] = [];
    const settledMarkets: any[] = [];

    // Use config for market info, DB for stats
    for (const [internalId, config] of Object.entries(MARKETS)) {
      const dbData = dbDataMap.get(internalId) || { totalTrades: 0, totalVolume: "0", settledAt: null };

      const marketData = {
        internalId,
        displayId: config.displayId,
        title: config.title,
        status: config.status,
        totalTrades: dbData.totalTrades,
        totalVolume: dbData.totalVolume,
        models: config.models,
        winnerIdx: config.winnerIdx,
        winnerName: config.winnerIdx !== undefined 
          ? config.models.find(m => m.idx === config.winnerIdx)?.name 
          : undefined,
        endDate: config.endDate,
        settledAt: dbData.settledAt,
      };

      if (config.status === "settled") {
        settledMarkets.push(marketData);
      } else {
        activeMarkets.push(marketData);
      }
    }

    // Sort by display ID
    activeMarkets.sort((a, b) => parseInt(b.displayId) - parseInt(a.displayId));
    settledMarkets.sort((a, b) => parseInt(b.displayId) - parseInt(a.displayId));

    return { activeMarkets, settledMarkets };
  } catch (e) {
    console.error("Markets fetch error:", e);
    return { activeMarkets: [], settledMarkets: [] };
  }
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

export default async function MarketsPage() {
  const { activeMarkets, settledMarkets } = await getMarketsData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Markets</h1>
        <p className="text-zinc-400">All Delphi prediction markets on Gensyn Testnet</p>
      </div>

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
                <MarketCard key={market.internalId} market={market} />
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
                <MarketCard key={market.internalId} market={market} isSettled />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MarketCard({ market, isSettled = false }: { market: any; isSettled?: boolean }) {
  return (
    <Link href={`/markets/${market.internalId}`} className="card p-5 card-hover block">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate mb-1">
            Market #{market.displayId}
          </h3>
          <p className="text-sm text-zinc-400 truncate">{market.title}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
          isSettled ? "badge-settled" : "badge-active"
        }`}>
          {isSettled ? "Settled" : "Active"}
        </span>
      </div>

      {/* Winner for Settled */}
      {isSettled && market.winnerName && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-xs text-amber-400/70 mb-1">🏆 Winner</p>
          <p className="text-sm text-amber-300 font-semibold truncate">
            {market.winnerName}
          </p>
        </div>
      )}

      {/* Models */}
      {market.models?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">
            Models ({market.models.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {market.models.map((model: any) => {
              const isWinner = isSettled && market.winnerIdx === model.idx;
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
                    style={{ backgroundColor: MODEL_COLORS[model.idx % MODEL_COLORS.length] }}
                  />
                  <span className="truncate max-w-[130px]">{model.name}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={`grid gap-4 pt-4 border-t border-[var(--border-color)] ${
        isSettled ? "grid-cols-3" : "grid-cols-2"
      }`}>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Trades</p>
          <p className="font-mono text-sm text-white">
            {market.totalTrades.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Volume</p>
          <p className="font-mono text-sm text-white">
            {formatVolume(market.totalVolume)}
          </p>
        </div>
        {isSettled && (
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Settled</p>
            <p className="text-xs text-zinc-400">
              {market.endDate || "—"}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
