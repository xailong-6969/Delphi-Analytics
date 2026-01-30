import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Simple in-memory cache for 5 minutes
let cachedLeaderboard: {
  data: Array<{ address: string; realizedPnl: string; totalVolume: string; totalTrades: number; rank: number }>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const sortBy = searchParams.get("sortBy") || "pnl";
    const search = searchParams.get("search")?.toLowerCase();

    // Use cache if valid
    const now = Date.now();
    if (cachedLeaderboard && now - cachedLeaderboard.timestamp < CACHE_DURATION && !search) {
      let traders = cachedLeaderboard.data;

      // Re-sort if needed
      if (sortBy === "volume") {
        traders = [...traders].sort((a, b) =>
          Number(BigInt(b.totalVolume) - BigInt(a.totalVolume))
        ).map((t, idx) => ({ ...t, rank: idx + 1 }));
      } else if (sortBy === "trades") {
        traders = [...traders].sort((a, b) =>
          b.totalTrades - a.totalTrades
        ).map((t, idx) => ({ ...t, rank: idx + 1 }));
      }

      const totalTraders = traders.length;
      const totalPages = Math.ceil(totalTraders / limit);
      const offset = (page - 1) * limit;
      const paginated = traders.slice(offset, offset + limit);

      return NextResponse.json({
        leaderboard: paginated,
        totalTraders,
        totalPages,
        currentPage: page,
        cached: true,
      });
    }

    // Fetch from pre-computed TraderStats table (much faster!)
    let orderBy: { realizedPnl?: "desc"; totalVolume?: "desc"; totalTrades?: "desc" } = { realizedPnl: "desc" };
    if (sortBy === "volume") orderBy = { totalVolume: "desc" };
    else if (sortBy === "trades") orderBy = { totalTrades: "desc" };

    // Handle search
    if (search) {
      const found = await prisma.traderStats.findMany({
        where: {
          address: { contains: search, mode: "insensitive" },
        },
        orderBy,
        take: 100,
      });

      const results = found.map((t, idx) => ({
        address: t.address,
        realizedPnl: t.realizedPnl,
        totalVolume: t.totalVolume,
        totalTrades: t.totalTrades,
        rank: idx + 1,
      }));

      return NextResponse.json({
        leaderboard: results,
        totalTraders: results.length,
        totalPages: 1,
        currentPage: 1,
      });
    }

    // Get total count
    const totalTraders = await prisma.traderStats.count();

    // Fetch all for caching and ranking (only addresses with trades)
    const allTraders = await prisma.traderStats.findMany({
      where: { totalTrades: { gt: 0 } },
      orderBy: { realizedPnl: "desc" },
      select: {
        address: true,
        realizedPnl: true,
        totalVolume: true,
        totalTrades: true,
      },
    });

    // Add ranks
    const tradersWithRank = allTraders.map((t, idx) => ({
      address: t.address,
      realizedPnl: t.realizedPnl,
      totalVolume: t.totalVolume,
      totalTrades: t.totalTrades,
      rank: idx + 1,
    }));

    // Update cache
    cachedLeaderboard = { data: tradersWithRank, timestamp: now };

    // Re-sort if needed
    let finalTraders = tradersWithRank;
    if (sortBy === "volume") {
      finalTraders = [...tradersWithRank].sort((a, b) =>
        Number(BigInt(b.totalVolume) - BigInt(a.totalVolume))
      ).map((t, idx) => ({ ...t, rank: idx + 1 }));
    } else if (sortBy === "trades") {
      finalTraders = [...tradersWithRank].sort((a, b) =>
        b.totalTrades - a.totalTrades
      ).map((t, idx) => ({ ...t, rank: idx + 1 }));
    }

    // Paginate
    const totalPages = Math.ceil(finalTraders.length / limit);
    const offset = (page - 1) * limit;
    const paginated = finalTraders.slice(offset, offset + limit);

    return NextResponse.json({
      leaderboard: paginated,
      totalTraders: finalTraders.length,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({
      leaderboard: [],
      totalTraders: 0,
      totalPages: 0,
      currentPage: 1,
      error: "Failed to fetch leaderboard",
    });
  }
}
