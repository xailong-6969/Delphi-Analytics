import type { PrismaClient } from "@prisma/client";
import { MARKETS, type MarketConfig, normalizeMarketId } from "@/lib/markets-config";
import { parseModelsJson } from "@/lib/utils";

export interface LiveMarketModel {
  idx: number;
  name: string;
  family: string;
}

export interface LiveMarketSummary {
  internalId: string;
  displayId: string;
  title: string;
  description: string | null;
  category: string | null;
  configUri: string | null;
  status: "active" | "settled";
  statusCode: number;
  type: "model" | "outcome";
  winnerIdx?: number;
  winnerName?: string;
  models: LiveMarketModel[];
  totalTrades: number;
  totalVolume: string;
  createdAt: Date | null;
  endTime: Date | null;
  settledAt: Date | null;
  dateLabel: string | null;
  isCurrentActive: boolean;
}

type DbMarketRecord = {
  marketId: bigint;
  title: string | null;
  description: string | null;
  category: string | null;
  configUri: string | null;
  status: number;
  winningModelIdx: bigint | null;
  modelsJson: unknown;
  totalVolume: string;
  createdAtTime: Date | null;
  endTime: Date | null;
  settledAt: Date | null;
  _count?: {
    trades: number;
  };
  totalTrades?: number;
};

function normalizeModels(modelsJson: unknown, fallback?: MarketConfig): LiveMarketModel[] {
  const parsedModels = parseModelsJson(modelsJson).map((model) => ({
    idx: model.idx,
    name: model.modelName || model.fullName || `Model ${model.idx}`,
    family: model.familyName || "",
  }));

  if (parsedModels.length > 0) {
    return parsedModels;
  }

  return (
    fallback?.models.map((model) => ({
      idx: model.idx,
      name: model.name,
      family: model.family,
    })) ?? []
  );
}

function inferMarketType(models: LiveMarketModel[], fallback?: MarketConfig): "model" | "outcome" {
  if (fallback?.type) {
    return fallback.type;
  }

  if (models.length === 2) {
    const names = models.map((model) => model.name.toUpperCase());
    if (names.includes("YES") && names.includes("NO")) {
      return "outcome";
    }
  }

  return "model";
}

function isGenericTitle(title: string, internalId: string) {
  return title.trim().toUpperCase() === `MARKET #${internalId}`;
}

function hasRenderableMarketData(summary: Pick<
  LiveMarketSummary,
  "internalId" | "title" | "models" | "configUri" | "totalTrades" | "totalVolume"
>) {
  if (summary.models.length > 0) return true;
  if (summary.configUri) return true;
  return !isGenericTitle(summary.title, summary.internalId);
}

function isCurrentActiveMarket(summary: Pick<
  LiveMarketSummary,
  "status" | "endTime" | "internalId" | "title" | "models" | "configUri" | "totalTrades" | "totalVolume"
>) {
  if (summary.status !== "active") {
    return false;
  }

  if (!hasRenderableMarketData(summary)) {
    return false;
  }

  if (summary.endTime && summary.endTime.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

function formatDateLabel(
  market: Pick<LiveMarketSummary, "status" | "settledAt" | "endTime" | "createdAt">,
  fallback?: MarketConfig
) {
  if (fallback?.endDate) {
    return fallback.endDate;
  }

  const sourceDate =
    market.status === "settled" ? market.settledAt || market.endTime : market.endTime || market.createdAt;

  if (!sourceDate) {
    return null;
  }

  return sourceDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toFallbackSummary(internalId: string, fallback: MarketConfig): LiveMarketSummary {
  const models = fallback.models.map((model) => ({
    idx: model.idx,
    name: model.name,
    family: model.family,
  }));
  const type = inferMarketType(models, fallback);
  const winnerName =
    fallback.winnerIdx !== undefined
      ? models.find((model) => model.idx === fallback.winnerIdx)?.name
      : undefined;
  const endTime = fallback.endTimestamp ? new Date(fallback.endTimestamp) : null;

  return {
    internalId,
    displayId: fallback.displayId,
    title: fallback.title,
    description: null,
    category: null,
    configUri: null,
    status: fallback.status,
    statusCode: fallback.status === "settled" ? 2 : 0,
    type,
    winnerIdx: fallback.winnerIdx,
    winnerName,
    models,
    totalTrades: 0,
    totalVolume: "0",
    createdAt: null,
    endTime,
    settledAt: fallback.status === "settled" ? endTime : null,
    dateLabel: fallback.endDate,
    isCurrentActive:
      fallback.status === "active" && (!endTime || endTime.getTime() > Date.now()),
  };
}

function toLiveMarketSummary(record: DbMarketRecord): LiveMarketSummary {
  const internalId = record.marketId.toString();
  const fallback = MARKETS[internalId];
  const preferConfiguredSettlement = fallback?.status === "settled";
  const models = preferConfiguredSettlement
    ? fallback.models.map((model) => ({
        idx: model.idx,
        name: model.name,
        family: model.family,
      }))
    : normalizeModels(record.modelsJson, fallback);
  const status = preferConfiguredSettlement || record.status === 2 || record.settledAt ? "settled" : "active";
  const winnerIdx =
    preferConfiguredSettlement && fallback?.winnerIdx !== undefined
      ? fallback.winnerIdx
      : record.winningModelIdx !== null
      ? Number(record.winningModelIdx)
      : fallback?.winnerIdx;
  const winnerName =
    winnerIdx !== undefined ? models.find((model) => model.idx === winnerIdx)?.name : undefined;
  const totalTrades = record._count?.trades ?? record.totalTrades ?? 0;
  const title = record.title || fallback?.title || `Market #${internalId}`;
  const endTime = record.endTime || (fallback?.endTimestamp ? new Date(fallback.endTimestamp) : null);

  const summary: LiveMarketSummary = {
    internalId,
    displayId: fallback?.displayId || internalId,
    title,
    description: record.description || null,
    category: record.category || null,
    configUri: record.configUri || null,
    status,
    statusCode: preferConfiguredSettlement ? 2 : record.status,
    type: inferMarketType(models, fallback),
    winnerIdx,
    winnerName,
    models,
    totalTrades,
    totalVolume: record.totalVolume || "0",
    createdAt: record.createdAtTime || null,
    endTime,
    settledAt: record.settledAt || (preferConfiguredSettlement ? endTime : null),
    dateLabel: null,
    isCurrentActive: false,
  };

  summary.isCurrentActive = isCurrentActiveMarket(summary);
  summary.dateLabel = formatDateLabel(summary, fallback);
  return summary;
}

export function isNumericMarketId(value: string) {
  return /^\d+$/.test(normalizeMarketId(value));
}

export async function getLiveMarkets(prisma: PrismaClient): Promise<LiveMarketSummary[]> {
  const dbMarkets = await prisma.market.findMany({
    include: { _count: { select: { trades: true } } },
    orderBy: { marketId: "desc" },
  });

  const summaries = dbMarkets.map(toLiveMarketSummary);
  const seen = new Set(summaries.map((market) => market.internalId));

  for (const [internalId, fallback] of Object.entries(MARKETS)) {
    if (!seen.has(internalId)) {
      summaries.push(toFallbackSummary(internalId, fallback));
    }
  }

  const visibleSummaries = summaries.filter(
    (market) => MARKETS[market.internalId] || hasRenderableMarketData(market)
  );

  visibleSummaries.sort((left, right) => Number(right.internalId) - Number(left.internalId));
  return visibleSummaries;
}

export async function getLiveMarketById(
  prisma: PrismaClient,
  rawMarketId: string
): Promise<LiveMarketSummary | null> {
  const internalId = normalizeMarketId(rawMarketId);

  if (!isNumericMarketId(internalId)) {
    return null;
  }

  const market = await prisma.market.findUnique({
    where: { marketId: BigInt(internalId) },
    include: { _count: { select: { trades: true } } },
  });

  if (market) {
    const summary = toLiveMarketSummary(market);
    return MARKETS[summary.internalId] || hasRenderableMarketData(summary) ? summary : null;
  }

  const fallback = MARKETS[internalId];
  return fallback ? toFallbackSummary(internalId, fallback) : null;
}

export async function getSettledWinnerMap(prisma: PrismaClient) {
  const markets = await prisma.market.findMany({
    where: {
      status: 2,
      winningModelIdx: { not: null },
    },
    select: {
      marketId: true,
      winningModelIdx: true,
      settledAt: true,
    },
  });

  const winnerMap = Object.fromEntries(
    markets.map((market) => [
      market.marketId.toString(),
      {
        winnerIdx: Number(market.winningModelIdx),
        settledAt: market.settledAt,
      },
    ])
  ) as Record<string, { winnerIdx: number; settledAt: Date | null }>;

  for (const [marketId, config] of Object.entries(MARKETS)) {
    if (config.status !== "settled" || config.winnerIdx === undefined) {
      continue;
    }

    winnerMap[marketId] = {
      winnerIdx: config.winnerIdx,
      settledAt:
        winnerMap[marketId]?.settledAt ||
        (config.endTimestamp ? new Date(config.endTimestamp) : null),
    };
  }

  return winnerMap;
}
