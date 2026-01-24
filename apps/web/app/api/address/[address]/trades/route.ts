import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

interface TradeRow {
  txHash: string;
  blockTime: Date;
  marketId: bigint;
  modelIdx: bigint;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
  modelNewPrice: string;
}

export async function GET(
  req: Request, 
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  
  if (!rawAddress || !isHexAddress(rawAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const address = getAddress(rawAddress);

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const skip = Number(url.searchParams.get("skip") ?? 0);

  const rows = await prisma.trade.findMany({
    where: { trader: address },
    orderBy: [{ blockTime: "desc" }],
    take,
    skip,
    select: {
      txHash: true,
      blockTime: true,
      marketId: true,
      modelIdx: true,
      isBuy: true,
      tokensDelta: true,
      sharesDelta: true,
      modelNewPrice: true,
    },
  });

  const trades = rows.map((r: TradeRow) => {
    const priceRaw = BigInt(r.modelNewPrice.toString());
    const impliedPct = Number(priceRaw) / 1e16;
    return { 
      ...r, 
      marketId: r.marketId.toString(),
      modelIdx: r.modelIdx.toString(),
      impliedPct 
    };
  });

  return NextResponse.json({ address, take, skip, trades });
}
