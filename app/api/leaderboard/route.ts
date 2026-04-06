import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboardPage,
  searchLeaderboard,
  type LeaderboardSortBy,
} from "@/lib/leaderboard-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_SORTS: LeaderboardSortBy[] = ["pnl", "volume", "trades"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const requestedSort = (searchParams.get("sortBy") || "pnl") as LeaderboardSortBy;
    const sortBy = VALID_SORTS.includes(requestedSort) ? requestedSort : "pnl";
    const search = searchParams.get("search")?.trim();

    const payload = search
      ? await searchLeaderboard({ search, sortBy, limit })
      : await getLeaderboardPage({ page, limit, sortBy });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      {
        leaderboard: [],
        totalTraders: 0,
        totalPages: 0,
        currentPage: 1,
        error: "Failed to fetch leaderboard",
      },
      { status: 500 }
    );
  }
}
