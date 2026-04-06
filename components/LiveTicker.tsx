"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { formatAddress, formatTokens } from "@/lib/utils";

interface TickerTrade {
  id: string;
  trader: string;
  isBuy: boolean;
  tokensDelta: string;
  marketId: string;
}

export default function LiveTicker() {
  const [trades, setTrades] = useState<TickerTrade[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchTrades() {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (json.recentTrades?.length) {
          setTrades(json.recentTrades.slice(0, 12));
        }
      } catch {
        // Silently fail — ticker just won't show
      }
    }
    fetchTrades();
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate fallback items if no live data
  const tickerItems = trades.length > 0 ? trades : null;

  if (!tickerItems) {
    // Static fallback ticker
    return (
      <div className="ticker-strip">
        <div className="ticker-track">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="ticker-content" aria-hidden={dup > 0}>
              {[
                "DELPHI ANALYTICS",
                "PREDICTION MARKETS",
                "GENSYN TESTNET",
                "LIVE DATA",
                "ON-CHAIN TRADES",
                "REAL-TIME ODDS",
              ].map((text, i) => (
                <span key={i} className="ticker-item ticker-item-static">
                  <span className="ticker-diamond">◆</span>
                  {text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-strip" ref={containerRef}>
      <div className="ticker-track">
        {[...Array(2)].map((_, dup) => (
          <div key={dup} className="ticker-content" aria-hidden={dup > 0}>
            {tickerItems.map((trade, i) => (
              <span key={`${dup}-${trade.id}-${i}`} className="ticker-item">
                <span className={`ticker-dot ${trade.isBuy ? "ticker-dot-buy" : "ticker-dot-sell"}`} />
                <span className="ticker-address">
                  {formatAddress(trade.trader, 3)}
                </span>
                <span className={`ticker-action ${trade.isBuy ? "text-emerald-400" : "text-red-400"}`}>
                  {trade.isBuy ? "bought" : "sold"}
                </span>
                <span className="ticker-amount">
                  {formatTokens(trade.tokensDelta)} $TEST
                </span>
                <span className="ticker-diamond">◆</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
