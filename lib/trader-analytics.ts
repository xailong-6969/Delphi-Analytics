import { MARKET_WINNERS } from "@/lib/markets-config";

const TOKEN_SCALE = 10n ** 18n;

export interface TraderAnalyticsTrade {
  marketId: bigint;
  modelIdx: bigint;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
  blockTime: Date | string;
}

interface PositionState {
  shares: bigint;
  cost: bigint;
  lastTradeTime: Date;
}

interface TimelineEvent {
  time: Date;
  pnlDelta: bigint;
  volume: bigint;
  kind: "trade" | "settlement";
}

export interface PnlChartPoint {
  time: string;
  displayTime: string;
  pnl: number;
  cumulativePnl: number;
  volume: number;
}

export interface TraderAnalyticsSummary {
  totalVolume: bigint;
  buyVolume: bigint;
  sellVolume: bigint;
  buyCount: number;
  sellCount: number;
  marketsTraded: number;
  modelsTraded: number;
  openPositions: number;
  realizedPnl: bigint;
  totalCostBasis: bigint;
  unrealizedCostBasis: bigint;
  firstTrade: Date | null;
  lastTrade: Date | null;
  chartData: PnlChartPoint[];
}

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function bigintToTokenNumber(value: bigint): number {
  const sign = value < 0n ? -1 : 1;
  const absolute = value < 0n ? -value : value;
  const whole = absolute / TOKEN_SCALE;
  const fraction = absolute % TOKEN_SCALE;
  const fractionString = fraction.toString().padStart(18, "0").slice(0, 6);
  const numeric = Number(`${whole.toString()}.${fractionString}`);
  return sign * numeric;
}

export function analyzeTraderTrades(
  trades: TraderAnalyticsTrade[],
  marketSettledAtById: Record<string, Date | null> = {}
): TraderAnalyticsSummary {
  if (trades.length === 0) {
    return {
      totalVolume: 0n,
      buyVolume: 0n,
      sellVolume: 0n,
      buyCount: 0,
      sellCount: 0,
      marketsTraded: 0,
      modelsTraded: 0,
      openPositions: 0,
      realizedPnl: 0n,
      totalCostBasis: 0n,
      unrealizedCostBasis: 0n,
      firstTrade: null,
      lastTrade: null,
      chartData: [],
    };
  }

  const sortedTrades = [...trades].sort(
    (left, right) => normalizeDate(left.blockTime).getTime() - normalizeDate(right.blockTime).getTime()
  );

  let totalVolume = 0n;
  let buyVolume = 0n;
  let sellVolume = 0n;
  let buyCount = 0;
  let sellCount = 0;
  let realizedPnl = 0n;

  const marketsTraded = new Set<string>();
  const modelsTraded = new Set<string>();
  const positions = new Map<string, PositionState>();
  const events: TimelineEvent[] = [];

  for (const trade of sortedTrades) {
    const blockTime = normalizeDate(trade.blockTime);
    const tokens = BigInt(trade.tokensDelta);
    const shares = BigInt(trade.sharesDelta);
    const absTokens = tokens < 0n ? -tokens : tokens;
    const absShares = shares < 0n ? -shares : shares;
    const marketId = trade.marketId.toString();
    const modelIdx = trade.modelIdx.toString();
    const positionKey = `${marketId}:${modelIdx}`;

    totalVolume += absTokens;
    marketsTraded.add(marketId);
    modelsTraded.add(positionKey);

    const position = positions.get(positionKey) || {
      shares: 0n,
      cost: 0n,
      lastTradeTime: blockTime,
    };

    let pnlDelta = 0n;

    if (trade.isBuy) {
      buyCount += 1;
      buyVolume += absTokens;
      position.shares += absShares;
      position.cost += absTokens;
    } else {
      sellCount += 1;
      sellVolume += absTokens;

      if (position.shares > 0n) {
        const avgCost = (position.cost * TOKEN_SCALE) / position.shares;
        const costBasis = (avgCost * absShares) / TOKEN_SCALE;
        pnlDelta = absTokens - costBasis;
        realizedPnl += pnlDelta;

        position.shares -= absShares;
        position.cost -= costBasis;
        if (position.shares < 0n) position.shares = 0n;
        if (position.cost < 0n) position.cost = 0n;
      } else {
        pnlDelta = absTokens;
        realizedPnl += pnlDelta;
      }
    }

    position.lastTradeTime = blockTime;
    positions.set(positionKey, position);
    events.push({
      time: blockTime,
      pnlDelta,
      volume: absTokens,
      kind: "trade",
    });
  }

  let openPositions = 0;
  let totalCostBasis = 0n;
  let unrealizedCostBasis = 0n;

  for (const [positionKey, position] of positions.entries()) {
    totalCostBasis += position.cost;

    if (position.shares <= 0n) {
      continue;
    }

    const [marketId, modelIdx] = positionKey.split(":");
    const winnerIdx = MARKET_WINNERS[marketId];

    if (winnerIdx === undefined) {
      openPositions += 1;
      unrealizedCostBasis += position.cost;
      continue;
    }

    const settlementDelta =
      Number(modelIdx) === winnerIdx ? position.shares - position.cost : -position.cost;

    realizedPnl += settlementDelta;

    events.push({
      time: marketSettledAtById[marketId] || position.lastTradeTime,
      pnlDelta: settlementDelta,
      volume: 0n,
      kind: "settlement",
    });
  }

  events.sort((left, right) => {
    const timeDelta = left.time.getTime() - right.time.getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }
    if (left.kind === right.kind) {
      return 0;
    }
    return left.kind === "trade" ? -1 : 1;
  });

  const dailyData = new Map<string, PnlChartPoint>();
  let cumulativePnl = 0n;
  const displayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  for (const event of events) {
    cumulativePnl += event.pnlDelta;

    const dayKey = event.time.toISOString().slice(0, 10);
    const existing = dailyData.get(dayKey);

    if (existing) {
      existing.pnl += bigintToTokenNumber(event.pnlDelta);
      existing.volume += bigintToTokenNumber(event.volume);
      existing.cumulativePnl = bigintToTokenNumber(cumulativePnl);
      existing.time = event.time.toISOString();
      continue;
    }

    dailyData.set(dayKey, {
      time: event.time.toISOString(),
      displayTime: displayFormatter.format(event.time),
      pnl: bigintToTokenNumber(event.pnlDelta),
      cumulativePnl: bigintToTokenNumber(cumulativePnl),
      volume: bigintToTokenNumber(event.volume),
    });
  }

  return {
    totalVolume,
    buyVolume,
    sellVolume,
    buyCount,
    sellCount,
    marketsTraded: marketsTraded.size,
    modelsTraded: modelsTraded.size,
    openPositions,
    realizedPnl,
    totalCostBasis,
    unrealizedCostBasis,
    firstTrade: normalizeDate(sortedTrades[0].blockTime),
    lastTrade: normalizeDate(sortedTrades[sortedTrades.length - 1].blockTime),
    chartData: Array.from(dailyData.values()),
  };
}
