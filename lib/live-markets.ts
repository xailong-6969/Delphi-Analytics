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
    family: model.familyName || model.familyName || "",
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
  };
}

function toLiveMarketSummary(record: DbMarketRecord): LiveMarketSummary {
  const internalId = record.marketId.toString();
  const fallback = MARKETS[internalId];
  const models = normalizeModels(record.modelsJson, fallback);
  const status = record.status === 2 || record.settledAt ? "settled" : "active";
  const winnerIdx =
    record.winningModelIdx !== null
      ? Number(record.winningModelIdx)
      : fallback?.winnerIdx;
  const winnerName =
    winnerIdx !== undefined ? models.find((model) => model.idx === winnerIdx)?.name : undefined;
  const totalTrades = record._count?.trades ?? record.totalTrades ?? 0;

  const summary: LiveMarketSummary = {
    internalId,
    displayId: fallback?.displayId || internalId,
    title: record.title || fallback?.title || `Market #${internalId}`,
    description: record.description || null,
    category: record.category || null,
    configUri: record.configUri || null,
    status,
    statusCode: record.status,
    type: inferMarketType(models, fallback),
    winnerIdx,
    winnerName,
    models,
    totalTrades,
    totalVolume: record.totalVolume || "0",
    createdAt: record.createdAtTime || null,
    endTime: record.endTime || (fallback?.endTimestamp ? new Date(fallback.endTimestamp) : null),
    settledAt: record.settledAt || null,
    dateLabel: null,
  };

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

  summaries.sort((left, right) => Number(right.internalId) - Number(left.internalId));
  return summaries;
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
    return toLiveMarketSummary(market);
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

  return Object.fromEntries(
    markets.map((market) => [
      market.marketId.toString(),
      {
        winnerIdx: Number(market.winningModelIdx),
        settledAt: market.settledAt,
      },
    ])
  ) as Record<string, { winnerIdx: number; settledAt: Date | null }>;
}
