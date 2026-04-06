import { Prisma } from "@prisma/client";
import { getAddress } from "viem";
import prisma from "@/lib/prisma";

export type LeaderboardSortBy = "pnl" | "volume" | "trades";

export interface LeaderboardRow {
  address: string;
  realizedPnl: string;
  totalVolume: string;
  totalTrades: number;
  rank: number;
}

function getOrderBySql(sortBy: LeaderboardSortBy) {
  switch (sortBy) {
    case "volume":
      return Prisma.sql`CAST("totalVolume" AS NUMERIC) DESC, "address" ASC`;
    case "trades":
      return Prisma.sql`"totalTrades" DESC, "address" ASC`;
    case "pnl":
    default:
      return Prisma.sql`CAST("realizedPnl" AS NUMERIC) DESC, "address" ASC`;
  }
}

function parseCountValue(value: bigint | number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

export async function getLeaderboardPage(params: {
  page: number;
  limit: number;
  sortBy: LeaderboardSortBy;
}) {
  const { page, limit, sortBy } = params;
  const offset = (page - 1) * limit;
  const totalTraders = await prisma.traderStats.count();
  const orderBySql = getOrderBySql(sortBy);

  const rows = await prisma.$queryRaw<
    Array<{
      address: string;
      realizedPnl: string;
      totalVolume: string;
      totalTrades: number;
    }>
  >(Prisma.sql`
    SELECT "address", "realizedPnl", "totalVolume", "totalTrades"
    FROM "TraderStats"
    ORDER BY ${orderBySql}
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return {
    leaderboard: rows.map((row, index) => ({
      ...row,
      rank: offset + index + 1,
    })),
    totalTraders,
    totalPages: totalTraders === 0 ? 0 : Math.ceil(totalTraders / limit),
    currentPage: page,
  };
}

export async function getTraderRankSnapshot(address: string, sortBy: LeaderboardSortBy = "pnl") {
  const normalizedAddress = getAddress(address);
  const trader = await prisma.traderStats.findUnique({
    where: { address: normalizedAddress },
    select: {
      address: true,
      realizedPnl: true,
      totalVolume: true,
      totalTrades: true,
    },
  });

  if (!trader) {
    return null;
  }

  let betterCountRows: Array<{ count: bigint | number | string }> = [];

  if (sortBy === "volume") {
    betterCountRows = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "TraderStats"
      WHERE CAST("totalVolume" AS NUMERIC) > CAST(${trader.totalVolume} AS NUMERIC)
         OR (
           CAST("totalVolume" AS NUMERIC) = CAST(${trader.totalVolume} AS NUMERIC)
           AND "address" < ${trader.address}
         )
    `);
  } else if (sortBy === "trades") {
    betterCountRows = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "TraderStats"
      WHERE "totalTrades" > ${trader.totalTrades}
         OR ("totalTrades" = ${trader.totalTrades} AND "address" < ${trader.address})
    `);
  } else {
    betterCountRows = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "TraderStats"
      WHERE CAST("realizedPnl" AS NUMERIC) > CAST(${trader.realizedPnl} AS NUMERIC)
         OR (
           CAST("realizedPnl" AS NUMERIC) = CAST(${trader.realizedPnl} AS NUMERIC)
           AND "address" < ${trader.address}
         )
    `);
  }

  const totalTraders = await prisma.traderStats.count();
  const rank = parseCountValue(betterCountRows[0]?.count) + 1;

  return {
    ...trader,
    rank,
    totalTraders,
  };
}

export async function searchLeaderboard(params: {
  search: string;
  sortBy: LeaderboardSortBy;
  limit?: number;
}) {
  const { search, sortBy, limit = 50 } = params;
  const trimmed = search.trim();
  const totalTraders = await prisma.traderStats.count();

  if (!trimmed) {
    return {
      leaderboard: [],
      totalTraders,
      totalPages: 1,
      currentPage: 1,
    };
  }

  const exactAddressMatch = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  if (exactAddressMatch) {
    const rankedTrader = await getTraderRankSnapshot(trimmed, sortBy);
    return {
      leaderboard: rankedTrader
        ? [
            {
              address: rankedTrader.address,
              realizedPnl: rankedTrader.realizedPnl,
              totalVolume: rankedTrader.totalVolume,
              totalTrades: rankedTrader.totalTrades,
              rank: rankedTrader.rank,
            },
          ]
        : [],
      totalTraders,
      totalPages: 1,
      currentPage: 1,
    };
  }

  const orderBySql = getOrderBySql(sortBy);
  const pattern = `%${trimmed}%`;

  const rows = await prisma.$queryRaw<LeaderboardRow[]>(Prisma.sql`
    WITH ranked AS (
      SELECT
        "address",
        "realizedPnl",
        "totalVolume",
        "totalTrades",
        CAST(ROW_NUMBER() OVER (ORDER BY ${orderBySql}) AS INTEGER) AS rank
      FROM "TraderStats"
    )
    SELECT "address", "realizedPnl", "totalVolume", "totalTrades", rank
    FROM ranked
    WHERE LOWER("address") LIKE LOWER(${pattern})
    ORDER BY rank ASC
    LIMIT ${limit}
  `);

  return {
    leaderboard: rows,
    totalTraders,
    totalPages: 1,
    currentPage: 1,
  };
}
