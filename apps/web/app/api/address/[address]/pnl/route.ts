import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createPublicClient, http, getAddress } from "viem";
import delphiAbi from "@/lib/delphi.abi.json"; // put ABI here (or re-export from packages)
const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_URL!;
const DELPHI_IMPL = (process.env.DELPHI_IMPL ??
  "0xaC46F41Df8188034Eb459Bb4c8FaEcd6EE369fdf") as `0x${string}`;

if (!RPC_URL) throw new Error("Missing RPC_URL");

const client = createPublicClient({
  transport: http(RPC_URL),
});

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

type PositionKey = string; // `${marketId}:${modelIdx}`

type Position = {
  marketId: bigint;
  modelIdx: bigint;
  sharesHeld: bigint;
  costBasis: bigint;      // tokens still tied to held shares
  realizedPnl: bigint;    // realized tokens pnl from sells
};

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  const raw = params.address?.trim();
  if (!raw || !isHexAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Normalize to checksum to match how you stored it (recommended)
  const address = getAddress(raw);

  // Pull all trades for this wallet in chronological order (oldest -> newest)
  const trades = await prisma.trade.findMany({
    where: {
      OR: [{ trader: address }, { trader: address.toLowerCase() }],
    },
    orderBy: { blockTime: "asc" },
    select: {
      marketId: true,
      modelIdx: true,
      isBuy: true,
      tokensDelta: true,
      sharesDelta: true,
      blockTime: true,
      txHash: true,
    },
  });

  // Aggregate positions
  const positions = new Map<PositionKey, Position>();

  const getPos = (marketId: bigint, modelIdx: bigint) => {
    const key = `${marketId.toString()}:${modelIdx.toString()}`;
    let p = positions.get(key);
    if (!p) {
      p = { marketId, modelIdx, sharesHeld: 0n, costBasis: 0n, realizedPnl: 0n };
      positions.set(key, p);
    }
    return p;
  };

  // Average-cost accounting
  for (const t of trades) {
    const marketId = BigInt(t.marketId.toString());
    const modelIdx = BigInt(t.modelIdx.toString());
    const tokens = BigInt(t.tokensDelta.toString());
    const shares = BigInt(t.sharesDelta.toString());

    const p = getPos(marketId, modelIdx);

    if (t.isBuy) {
      p.sharesHeld += shares;
      p.costBasis += tokens;
    } else {
      // Sell: compute cost removed using average cost per share
      if (p.sharesHeld === 0n) {
        // Edge case: sell without tracked buys (could happen if history truncated)
        // Treat as fully realized proceeds (conservative handling)
        p.realizedPnl += tokens;
        continue;
      }

      // avgCostPerShare = costBasis / sharesHeld  (integer division)
      const avgCostPerShare = p.costBasis / p.sharesHeld;

      // costRemoved = avgCostPerShare * sharesSold
      const costRemoved = avgCostPerShare * shares;

      const proceeds = tokens;
      p.realizedPnl += proceeds - costRemoved;

      // Update remaining position
      p.sharesHeld -= shares;

      // Prevent underflow if rounding makes costRemoved slightly > costBasis
      p.costBasis = p.costBasis > costRemoved ? (p.costBasis - costRemoved) : 0n;
    }
  }

  // Prepare open positions for unrealized PnL quoting
  const openPositions = [...positions.values()].filter((p) => p.sharesHeld > 0n);

  // To protect RPC + latency, only quote top N positions by cost basis
  const MAX_QUOTES = 20;
  openPositions.sort((a, b) => (b.costBasis > a.costBasis ? 1 : -1));
  const quoted = openPositions.slice(0, MAX_QUOTES);
  const unquoted = openPositions.slice(MAX_QUOTES);

  // Quote exit value for top positions
  const quoteResults: Array<{
    marketId: string;
    modelIdx: string;
    sharesHeld: string;
    costBasis: string;
    exitValue: string;
    unrealizedPnl: string;
  }> = [];

  let totalRealized = 0n;
  let totalUnrealized = 0n;
  let totalCostBasis = 0n;
  let totalExitValue = 0n;

  for (const p of positions.values()) totalRealized += p.realizedPnl;

  // Live exit quotes (best mark-to-market)
  for (const p of quoted) {
    totalCostBasis += p.costBasis;

    const exitValue = (await client.readContract({
      address: DELPHI_IMPL,
      abi: delphiAbi,
      functionName: "quoteSellExactIn",
      args: [p.marketId, p.modelIdx, p.sharesHeld],
    })) as bigint;

    const unrealized = exitValue - p.costBasis;

    totalExitValue += exitValue;
    totalUnrealized += unrealized;

    quoteResults.push({
      marketId: p.marketId.toString(),
      modelIdx: p.modelIdx.toString(),
      sharesHeld: p.sharesHeld.toString(),
      costBasis: p.costBasis.toString(),
      exitValue: exitValue.toString(),
      unrealizedPnl: unrealized.toString(),
    });
  }

  // Fallback estimate for remaining positions (cheap approximation):
  // exit ≈ spotPrice * sharesHeld  (note: ignores slippage; label as estimate)
  // This keeps the endpoint fast even for active wallets.
  const estimateResults: typeof quoteResults = [];
  for (const p of unquoted) {
    totalCostBasis += p.costBasis;

    const spot = (await client.readContract({
      address: DELPHI_IMPL,
      abi: delphiAbi,
      functionName: "spotPrice",
      args: [p.marketId, p.modelIdx],
    })) as bigint;

    // spotPrice is UD60x18; exit ≈ sharesHeld * spot / 1e18
    const exitEst = (p.sharesHeld * spot) / 1_000_000_000_000_000_000n;
    const unrealizedEst = exitEst - p.costBasis;

    totalExitValue += exitEst;
    totalUnrealized += unrealizedEst;

    estimateResults.push({
      marketId: p.marketId.toString(),
      modelIdx: p.modelIdx.toString(),
      sharesHeld: p.sharesHeld.toString(),
      costBasis: p.costBasis.toString(),
      exitValue: exitEst.toString(),
      unrealizedPnl: unrealizedEst.toString(),
    });
  }

  const totalPnl = totalRealized + totalUnrealized;

  return NextResponse.json({
    address,
    totals: {
      realizedPnl: totalRealized.toString(),
      unrealizedPnl: totalUnrealized.toString(),
      totalPnl: totalPnl.toString(),
      costBasisOpen: totalCostBasis.toString(),
      exitValueOpen: totalExitValue.toString(),
      openPositions: openPositions.length,
      quotedPositions: quoted.length,
      estimatedPositions: unquoted.length,
    },
    positions: {
      quoted: quoteResults,       // best accuracy (uses quoteSellExactIn)
      estimated: estimateResults, // fast fallback (uses spotPrice)
    },
    notes: [
      "Realized PnL uses average-cost accounting per market/model.",
      "Unrealized PnL uses on-chain exit quotes for top positions and spotPrice estimates for the rest.",
      "Values are in the market token units (e.g., $TEST) and are testnet-only.",
    ],
  });
}
