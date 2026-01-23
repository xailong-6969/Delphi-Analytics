import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createPublicClient, http, getAddress } from "viem";
import delphiAbi from "@/lib/delphi.abi.json";

// REQUIRED for Railway Build
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_URL!;
const DELPHI_IMPL = (process.env.DELPHI_IMPL ?? "0xCaC4F41Df8188034Eb459Bb4c8FaEcd6EE369fdf") as `0x${string}`;

if (!RPC_URL) throw new Error("Missing RPC_URL");

const client = createPublicClient({ transport: http(RPC_URL) });

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

type Position = {
  marketId: bigint;
  modelIdx: bigint;
  sharesHeld: bigint;
  costBasis: bigint;
  realizedPnl: bigint;
};

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address: rawAddress } = await params;
  const raw = rawAddress?.trim();
  
  if (!raw || !isHexAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const address = getAddress(raw);

  const trades = await prisma.trade.findMany({
    where: { trader: address },
    orderBy: { blockTime: "asc" },
  });

  const positions = new Map<string, Position>();

  for (const t of trades) {
    const key = `${t.marketId}:${t.modelIdx}`;
    let p = positions.get(key);
    if (!p) {
      p = { marketId: BigInt(t.marketId), modelIdx: BigInt(t.modelIdx), sharesHeld: 0n, costBasis: 0n, realizedPnl: 0n };
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

  const openPositions = [...positions.values()].filter((p) => p.sharesHeld > 0n);
  // ... rest of your PnL logic (quoting/estimation) remains the same
  return NextResponse.json({ address, totals: { /* ... */ } });
}
