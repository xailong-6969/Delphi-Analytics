"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatAddress, formatNumber, formatTimeAgo, formatTokens } from "@/lib/utils";
import FeaturedMarketHero from "@/components/FeaturedMarketHero";
import ScrollReveal, {
  StaggerContainer,
  StaggerItem,
} from "@/components/ScrollReveal";
import type { LiveMarketSummary } from "@/lib/live-markets";

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

interface MarketsResponse {
  markets: LiveMarketSummary[];
}

interface LeaderboardTrader {
  rank: number;
  address: string;
  realizedPnl: string;
  totalVolume: string;
  totalTrades: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardTrader[];
}

function formatMarketChipDate(market: LiveMarketSummary): string {
  return market.dateLabel || (market.isCurrentActive ? "Live market" : "Resolved");
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [liveMarkets, setLiveMarkets] = useState<LiveMarketSummary[]>([]);
  const [leaderboardPreview, setLeaderboardPreview] = useState<LeaderboardTrader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [statsRes, marketsRes, leaderboardRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/markets"),
          fetch("/api/leaderboard?page=1&limit=6&sortBy=pnl"),
        ]);
        const [statsJson, marketsJson, leaderboardJson]: [
          HomeData,
          MarketsResponse,
          LeaderboardResponse & { error?: string },
        ] = await Promise.all([
          statsRes.json(),
          marketsRes.json(),
          leaderboardRes.json(),
        ]);

        if (!(statsJson as any).error) {
          setData(statsJson);
        }
        if (!(marketsJson as any).error) {
          setLiveMarkets(marketsJson.markets || []);
        }
        if (!(leaderboardJson as any).error) {
          setLeaderboardPreview(leaderboardJson.leaderboard || []);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
    const interval = window.setInterval(fetchDashboardData, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const sortedMarkets = [...liveMarkets].sort(
    (left, right) => Number(right.internalId) - Number(left.internalId)
  );
  const featuredMarket = liveMarkets.find((market) => market.isCurrentActive) || null;
  const marketDisplayMap = new Map(
    liveMarkets.map((market) => [market.internalId, market.displayId])
  );

  const heroProofCards = [
    {
      label: "24H volume",
      value: data ? formatNumber(Number(data.volume24h || 0) / 1e18) : "0",
      caption: `${(data?.trades24h ?? 0).toLocaleString()} trades`,
      accent: "accent-emerald",
    },
    {
      label: "Tracked wallets",
      value: formatNumber(data?.uniqueTraders ?? 0, 0),
      caption: "Live participant map",
      accent: "accent-cyan",
    },
    {
      label: "Active markets",
      value: String(data?.activeMarkets ?? 0),
      caption: "Current Delphi flow",
      accent: "accent-gold",
    },
  ];

  const heroSystemItems = [
    {
      label: data?.lastIndexedAt ? "Indexer synced" : "Indexer waiting",
      value: data?.lastIndexedAt ? formatTimeAgo(data.lastIndexedAt) : "Awaiting first sync",
      tone: "system-cyan",
    },
    {
      label: featuredMarket ? "Live market" : "Market standby",
      value: featuredMarket ? `Market #${featuredMarket.displayId} open` : "No live market",
      tone: featuredMarket ? "system-emerald" : "system-gold",
    },
    {
      label: featuredMarket ? "Tracking Delphi" : "Watching Delphi",
      value: featuredMarket
        ? "Transactions and pricing update automatically"
        : "Ready for the next official launch",
      tone: "system-violet",
    },
  ];

  const heroWatchCards = [
    {
      label: "Indexer freshness",
      value: data?.lastIndexedAt ? formatTimeAgo(data.lastIndexedAt) : "Waiting",
      caption: data?.lastIndexedBlock ? `Block ${data.lastIndexedBlock}` : "Awaiting sync",
      accent: "accent-cyan",
    },
    {
      label: featuredMarket ? "Live market" : "Market status",
      value: featuredMarket ? `#${featuredMarket.displayId}` : "Standby",
      caption: featuredMarket
        ? "Homepage switches with live Delphi activity"
        : "The next market will appear here automatically",
      accent: "accent-gold",
    },
    {
      label: "Archive depth",
      value: String(data?.settledMarkets ?? 0),
      caption: `${formatNumber(data?.totalTrades ?? 0, 0)} indexed trades`,
      accent: "accent-emerald",
    },
  ];

  const signalCards = [
    {
      label: "24H Volume",
      value: data ? formatNumber(Number(data.volume24h || 0) / 1e18) : "0",
      caption: `${(data?.trades24h ?? 0).toLocaleString()} trades in the last day`,
      accent: "accent-emerald",
    },
    {
      label: "Unique Traders",
      value: formatNumber(data?.uniqueTraders ?? 0, 0),
      caption: `${formatNumber(data?.totalTrades ?? 0, 0)} total indexed trades`,
      accent: "accent-cyan",
    },
    {
      label: "Active Markets",
      value: String(data?.activeMarkets ?? 0),
      caption: "Open Delphi opportunities",
      accent: "accent-blue",
    },
    {
      label: "Settled Archive",
      value: String(data?.settledMarkets ?? 0),
      caption: "Resolved benchmark rounds and outcomes",
      accent: "accent-violet",
    },
    {
      label: "All-Time Volume",
      value: data ? formatNumber(Number(data.totalVolume || 0) / 1e18) : "0",
      caption: "Total TEST routed through the exchange",
      accent: "accent-gold",
    },
    {
      label: "Indexer Freshness",
      value: data?.lastIndexedAt ? formatTimeAgo(data.lastIndexedAt) : "Waiting",
      caption: data?.lastIndexedBlock
        ? `Last block ${data.lastIndexedBlock}`
        : "Awaiting first sync",
      accent: "accent-ice",
    },
  ];

  if (loading) {
    return (
      <div className="page-shell mx-auto flex min-h-[70vh] max-w-[92rem] items-center justify-center px-4 pt-4 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="home-loading-panel"
        >
          <div className="home-loading-ring" />
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-zinc-500">
            Loading Delphi Testnet Statistics
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-shell home-page-shell mx-auto max-w-[92rem] px-4 pt-4 pb-8 space-y-10">
      <section className="home-command-hero">
        <motion.div
          className="home-command-copy"
          initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="home-signal-badge">Delphi Testnet Analytics</span>
          <p className="home-command-kicker">
            A premium statistics and analytics dashboard for Delphi on Gensyn Testnet.
          </p>
          <h1 className="home-command-title">
            Track market conviction, wallet behavior, and resolution history in one
            <span className="gradient-text-luxury"> live dashboard.</span>
          </h1>
          <p className="home-command-description">
            Delphi Analytics turns live Gensyn testnet activity into a cleaner statistics
            interface: featured market tracking, ranked trader analytics, and sharper market
            browsing that updates itself as Delphi activity changes.
          </p>

          <div className="home-system-strip" aria-label="Live system status">
            {heroSystemItems.map((item) => (
              <div key={item.label} className={`home-system-chip ${item.tone}`}>
                <span className="home-system-dot" aria-hidden="true" />
                <div className="home-system-copy">
                  <span className="home-system-label">{item.label}</span>
                  <span className="home-system-value">{item.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="home-command-actions">
            <Link href="/markets" className="premium-button-primary">
              Explore Markets
            </Link>
            <Link href="/leaderboard" className="premium-button-secondary">
              View Leaderboard
            </Link>
            <a
              href="https://delphi.gensyn.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="premium-button-ghost"
            >
              Trade on Delphi
            </a>
          </div>

          <StaggerContainer className="home-proof-grid" staggerDelay={0.1}>
            {heroProofCards.map((card) => (
              <StaggerItem key={card.label}>
                <div className={`home-proof-card ${card.accent}`}>
                  <p className="home-proof-label">{card.label}</p>
                  <p className="home-proof-value">{card.value}</p>
                  <p className="home-proof-caption">{card.caption}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </motion.div>

        <motion.div
          className="home-command-stage"
          initial={{ opacity: 0, y: 34, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="home-stage-frame">
            <div className="home-stage-orbit orbit-one" aria-hidden="true" />
            <div className="home-stage-orbit orbit-two" aria-hidden="true" />
            <div className="home-stage-tag">
              <span className="home-stage-tag-label">
                {featuredMarket ? "Featured Market" : "Market Watch"}
              </span>
              <span className="home-stage-tag-value">
                {featuredMarket
                  ? `Live market #${featuredMarket.displayId} in Delphi`
                  : "New market will be announced soon"}
              </span>
            </div>
            <FeaturedMarketHero market={featuredMarket} />
          </div>

          <div className="home-stage-support">
            <div className="home-stage-support-header">
              <div>
                <span className="page-eyebrow">Delphi Watch</span>
                <h3 className="home-stage-support-title">
                  {featuredMarket
                    ? "Live market coverage stays in sync with Delphi."
                    : "Waiting for Delphi to open the next market."}
                </h3>
              </div>
              <a
                href="https://delphi.gensyn.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="home-stage-support-link"
              >
                Official Delphi
              </a>
            </div>

            <p className="home-stage-support-description">
              {featuredMarket
                ? "This panel refreshes from indexed Delphi activity, so live trades, pricing, and the market detail view update without manual edits."
                : "Until the next live market appears, this space stays on watch and then flips automatically into live pricing and transaction flow as soon as Delphi launches it."}
            </p>

            <div className="home-stage-support-grid">
              {heroWatchCards.map((card) => (
                <div key={card.label} className={`home-stage-support-card ${card.accent}`}>
                  <p className="home-stage-support-label">{card.label}</p>
                  <p className="home-stage-support-value">{card.value}</p>
                  <p className="home-stage-support-caption">{card.caption}</p>
                </div>
              ))}
            </div>

            <div className="home-stage-support-actions">
              <Link
                href={featuredMarket ? `/markets/${featuredMarket.internalId}` : "/markets"}
                className="home-stage-support-button"
              >
                {featuredMarket ? "Open Live Market" : "Browse Market Archive"}
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <ScrollReveal duration={0.8} distance={34}>
        <section className="section-panel home-signal-section">
          <div className="section-panel-header">
            <div className="section-panel-copy">
              <span className="page-eyebrow">Signal Snapshot</span>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                The market in one quick read
              </h2>
              <p>
                A tighter command-strip for volume, participation, archive depth, and indexer
                freshness.
              </p>
            </div>
          </div>

          <StaggerContainer className="home-signal-grid" staggerDelay={0.08}>
            {signalCards.map((card) => (
              <StaggerItem key={card.label}>
                <div className={`home-signal-card ${card.accent}`}>
                  <p className="home-signal-label">{card.label}</p>
                  <p className="home-signal-value">{card.value}</p>
                  <p className="home-signal-caption">{card.caption}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </ScrollReveal>

      {data?.recentTrades && data.recentTrades.length > 0 && (
        <ScrollReveal duration={0.78} distance={30}>
          <section className="section-panel overflow-hidden">
            <div className="section-panel-header">
              <div className="section-panel-copy">
                <span className="page-eyebrow">Flow Monitor</span>
                <h2 className="mt-4 text-2xl font-semibold text-white">Recent trades</h2>
                <p>The latest wallet activity across tracked Delphi markets.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="home-live-pill">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live feed</span>
                </div>
                <Link href="/markets" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  View all markets
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Trader</th>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTrades.slice(0, 8).map((trade, idx) => {
                    const internalId = trade.marketId.toString();
                    const displayId = marketDisplayMap.get(internalId) || internalId;

                    return (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0, x: -18, filter: "blur(4px)" }}
                        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                        transition={{
                          delay: 0.06 * idx,
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="table-row border-b border-[var(--border-color)] last:border-0"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trade.isBuy
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            }`}
                          >
                            {trade.isBuy ? "BUY" : "SELL"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/address/${trade.trader}`}
                            className="font-mono text-sm text-zinc-300 hover:text-cyan-300 transition-colors"
                          >
                            {formatAddress(trade.trader, 4)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/markets/${internalId}`}
                            className="text-sm text-zinc-300 hover:text-white transition-colors"
                          >
                            Market #{displayId}
                          </Link>
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Index status
              </p>
              <p className="text-xs text-zinc-500">
                Last indexed block{" "}
                <span className="font-mono text-zinc-300">{data.lastIndexedBlock}</span>
                {data.lastIndexedAt ? (
                  <span className="ml-2">Updated {formatTimeAgo(data.lastIndexedAt)}</span>
                ) : null}
              </p>
            </div>
          </section>
        </ScrollReveal>
      )}

      <ScrollReveal duration={0.8} distance={30}>
        <section className="section-panel">
          <div className="section-panel-header">
            <div className="section-panel-copy">
              <span className="page-eyebrow">Market Atlas</span>
              <h2 className="mt-4 text-2xl font-semibold text-white">All markets at a glance</h2>
              <p>
                A cleaner browse view for live opportunities, settled rounds, and benchmark
                archives.
              </p>
            </div>
            <span className="hero-meta-pill">{sortedMarkets.length} tracked markets</span>
          </div>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" staggerDelay={0.06}>
            {sortedMarkets.map((market) => (
              <StaggerItem key={market.internalId}>
                <Link href={`/markets/${market.internalId}`} className="card market-preview-card p-5 block">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Market #{market.displayId}
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-white leading-snug">
                        {market.title}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        market.isCurrentActive
                          ? "badge-active"
                          : "badge-settled"
                      }`}
                    >
                      {market.isCurrentActive ? "Live" : "Settled"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="market-mini-chip">{formatMarketChipDate(market)}</span>
                    <span className="market-mini-chip">
                      {market.models.length} {market.type === "model" ? "models" : "outcomes"}
                    </span>
                    {market.winnerIdx !== undefined ? (
                      <span className="market-mini-chip market-mini-chip-success">Resolved</span>
                    ) : null}
                  </div>

                  <div className="border-t border-white/6 pt-4 flex items-center justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      Open detail page
                    </p>
                    <span className="text-sm text-zinc-300">Inspect market</span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </ScrollReveal>

      <ScrollReveal duration={0.8} distance={30}>
        <section className="section-panel">
          <div className="section-panel-header">
            <div className="section-panel-copy">
              <span className="page-eyebrow">Leaderboard Preview</span>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Highest-performing wallets, right on the homepage
              </h2>
              <p>
                After market discovery, move straight into ranked trader performance without leaving
                the homepage flow.
              </p>
            </div>
            <Link href="/leaderboard" className="hero-meta-pill">
              Open full leaderboard
            </Link>
          </div>

          {leaderboardPreview.length > 0 ? (
            <StaggerContainer
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              staggerDelay={0.08}
            >
              {leaderboardPreview.map((trader) => (
                <StaggerItem key={trader.address}>
                  <Link
                    href={`/address/${trader.address}`}
                    className={`card market-preview-card home-leaderboard-card p-5 block ${
                      trader.rank === 1
                        ? "home-leaderboard-rank-1"
                        : trader.rank === 2
                          ? "home-leaderboard-rank-2"
                          : trader.rank === 3
                            ? "home-leaderboard-rank-3"
                            : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Rank #{trader.rank}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-white leading-snug">
                          {formatAddress(trader.address, 6)}
                        </h3>
                      </div>
                      <span className="home-leaderboard-rank-badge">
                        {trader.rank === 1
                          ? "1ST"
                          : trader.rank === 2
                            ? "2ND"
                            : trader.rank === 3
                              ? "3RD"
                              : `#${trader.rank}`}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="home-leaderboard-metric">
                        <span className="home-leaderboard-metric-label">Realized P&L</span>
                        <span className="home-leaderboard-metric-value">
                          {formatTokens(trader.realizedPnl)}
                        </span>
                      </div>
                      <div className="home-leaderboard-metric">
                        <span className="home-leaderboard-metric-label">Volume</span>
                        <span className="home-leaderboard-metric-value">
                          {formatTokens(trader.totalVolume)}
                        </span>
                      </div>
                      <div className="home-leaderboard-metric">
                        <span className="home-leaderboard-metric-label">Trades</span>
                        <span className="home-leaderboard-metric-value">
                          {trader.totalTrades.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/6 pt-4 flex items-center justify-between gap-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Open wallet analytics
                      </p>
                      <span className="text-sm text-zinc-300">Inspect address</span>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <div className="glass-empty-state rounded-[1.35rem] p-8 text-sm">
              Ranked wallets will appear here as soon as indexed Delphi activity is available.
            </div>
          )}
        </section>
      </ScrollReveal>
    </div>
  );
}
