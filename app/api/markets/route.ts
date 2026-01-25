import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // "active", "settled", or null for all
  const take = Math.min(Number(url.searchParams.get("take") || 50), 100);
  const skip = Number(url.searchParams.get("skip") || 0);

  try {
    const where: any = {};
    if (status === "active") where.status = 0;
    else if (status === "settled") where.status = 2;

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        orderBy: [
          { status: "asc" }, // Active first
          { createdAtTime: "desc" },
        ],
        take,
        skip,
        include: {
          _count: { select: { trades: true } },
        },
      }),
      prisma.market.count({ where }),
    ]);

    // Format for response
    const formatted = markets.map((m) => ({
      marketId: m.marketId.toString(),
      title: m.title,
      description: m.description,
      category: m.category,
      configUri: m.configUri,
      status: m.status,
      statusLabel: m.status === 0 ? "Active" : m.status === 2 ? "Settled" : "Unknown",
      winningModelIdx: m.winningModelIdx?.toString(),
      createdAt: m.createdAtTime,
      endTime: m.endTime,
      settledAt: m.settledAt,
      totalTrades: m._count.trades,
      totalVolume: m.totalVolume,
      modelsJson: m.modelsJson,
    }));

    return NextResponse.json({
      markets: formatted,
      total,
      take,
      skip,
    });
  } catch (e) {
    console.error("Markets API error:", e);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
