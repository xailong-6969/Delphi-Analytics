import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

interface TradeData {
  marketId: bigint;
  modelIdx: bigint;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
}

interface Position {
  marketId: bigint;
  modelIdx: bigint;
  sharesHeld: bigint;
  costBasis: bigint;
  realizedPnl: bigint;
}

export async function GET(
  _req: Request, 
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const raw = rawAddress?.trim();
  
  if (!raw || !isHexAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const address = getAddress(raw);

  const trades = await prisma.trade.findMany({
    where: { trader: address },
    orderBy: { blockTime: "asc" },
    select: {
      marketId: true,
      modelIdx: true,
      isBuy: true,
      tokensDelta: true,
      sharesDelta: true,
    },
  });

  const positions = new Map<string, Position>();

  for (const t of trades as TradeData[]) {
    const key = `${t.marketId}:${t.modelIdx}`;
    let p = positions.get(key);
    if (!p) {
      p = { 
        marketId: BigInt(t.marketId.toString()), 
        modelIdx: BigInt(t.modelIdx.toString()), 
        sharesHeld: 0n, 
        costBasis: 0n, 
        realizedPnl: 0n 
      };
      positions.set(key, p);
    }

    const tokens = BigInt(t.tokensDelta);
    const shares = BigInt(t.sharesDelta);

    if (t.isBuy) {
      p.sharesHeld += shares;
      p.costBasis += tokens;
    } else {
      if (p.sharesHeld > 0n) {
        const avgCostPerShare = p.costBasis / p.sharesHeld;
        const costRemoved = avgCostPerShare * shares;
        p.realizedPnl += tokens - costRemoved;
        p.sharesHeld -= shares;
        p.costBasis = p.costBasis > costRemoved ? (p.costBasis - costRemoved) : 0n;
      } else {
        p.realizedPnl += tokens;
      }
    }
  }

  let totalRealizedPnl = 0n;
  let totalCostBasis = 0n;
  let openPositionsCount = 0;

  const openPositions: Array<{
    marketId: string;
    modelIdx: string;
    sharesHeld: string;
    costBasis: string;
    realizedPnl: string;
  }> = [];

  for (const p of positions.values()) {
    totalRealizedPnl += p.realizedPnl;
    if (p.sharesHeld > 0n) {
      openPositionsCount++;
      totalCostBasis += p.costBasis;
      openPositions.push({
        marketId: p.marketId.toString(),
        modelIdx: p.modelIdx.toString(),
        sharesHeld: p.sharesHeld.toString(),
        costBasis: p.costBasis.toString(),
        realizedPnl: p.realizedPnl.toString(),
      });
    }
  }

  return NextResponse.json({ 
    address, 
    totals: {
      realizedPnl: totalRealizedPnl.toString(),
      totalPnl: totalRealizedPnl.toString(),
      unrealizedPnl: "0",
      costBasis: totalCostBasis.toString(),
      openPositionsCount,
    },
    openPositions,
  });
}
