import { createPublicClient, http, parseAbiItem, getAddress, type Log } from "viem";
import { PrismaClient } from "@prisma/client";

// ============================================
// CONFIGURATION
// ============================================
export const DELPHI_PROXY = "0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1" as const;
export const DELPHI_IMPL = "0xCaC4F41DF8188034Eb459Bb4c8FaEcd6EE369fdf" as const;
export const CHAIN_ID = 685685;
export const CHAIN_NAME = "Gensyn Testnet";

// Use implementation address for events (proxy delegates)
const CONTRACT_ADDRESS = DELPHI_IMPL;

// Batch configuration
const BATCH_SIZE = 1000; // blocks per batch
const CONFIRMATIONS = 2n; // wait for confirmations
const PRICE_SNAPSHOT_INTERVAL = 50; // save price every N blocks

// ============================================
// EVENT SIGNATURES
// ============================================
const EVENT_NEW_MARKET = parseAbiItem(
  "event NewMarket(uint128 indexed newMarketId, string newMarketConfigUri, bytes32 newMarketConfigUriHash)"
);

const EVENT_TRADE_EXECUTED = parseAbiItem(
  "event TradeExecuted(uint128 marketId, uint128 allowedModelIdx, address trader, bool isBuy, uint256 tokensDelta, uint256 modelSharesDelta, uint256 modelNewPrice, uint256 modelNewSupply, uint256 marketNewSupply)"
);

const EVENT_WINNERS = parseAbiItem(
  "event WinnersSubmitted(uint128 indexed marketId, uint128 winningModelIdx)"
);

// ============================================
// RPC CLIENT
// ============================================
function getClient() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL environment variable");
  
  return createPublicClient({
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    }),
  });
}

// ============================================
// HELPERS
// ============================================
function toDate(tsSeconds: bigint): Date {
  return new Date(Number(tsSeconds) * 1000);
}

function priceToPercent(price: bigint): number {
  // Price is in UD60x18 format: 1e18 = 100%
  return Number(price) / 1e16; // Returns 0-100
}

// Fetch metadata from configUri (IPFS or HTTP)
async function fetchMarketMetadata(configUri: string): Promise<{
  title?: string;
  description?: string;
  category?: string;
  endTime?: Date;
  models?: Array<{ idx: number; familyName: string; modelName: string; commitHash?: string }>;
} | null> {
  try {
    let url = configUri;
    
    // Handle IPFS URIs
    if (configUri.startsWith("ipfs://")) {
      url = `https://ipfs.io/ipfs/${configUri.slice(7)}`;
    }
    
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      title: data.title || data.name,
      description: data.description,
      category: data.category,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      models: data.models || data.options,
    };
  } catch (e) {
    console.warn(`Failed to fetch metadata from ${configUri}:`, e);
    return null;
  }
}

// ============================================
// EVENT HANDLERS
// ============================================
async function handleNewMarket(
  prisma: PrismaClient,
  log: Log,
  blockTime: Date
) {
  const args = (log as any).args;
  const marketId = BigInt(args.newMarketId.toString());
  const configUri = args.newMarketConfigUri as string;
  const configUriHash = args.newMarketConfigUriHash as string;

  // Fetch metadata
  let metadata = null;
  if (configUri) {
    metadata = await fetchMarketMetadata(configUri);
  }

  await prisma.market.upsert({
    where: { marketId },
    update: {
      configUri,
      configUriHash,
      title: metadata?.title,
      description: metadata?.description,
      category: metadata?.category,
      endTime: metadata?.endTime,
      modelsJson: metadata?.models ? JSON.stringify(metadata.models) : undefined,
    },
    create: {
      marketId,
      configUri,
      configUriHash,
      createdAtBlock: BigInt(log.blockNumber!.toString()),
      createdAtTime: blockTime,
      title: metadata?.title,
      description: metadata?.description,
      category: metadata?.category,
      endTime: metadata?.endTime,
      modelsJson: metadata?.models ? JSON.stringify(metadata.models) : undefined,
      status: 0,
    },
  });

  console.log(`📊 New market: #${marketId} - ${metadata?.title || 'Unknown'}`);
}

async function handleTradeExecuted(
  prisma: PrismaClient,
  log: Log,
  blockTime: Date
) {
  const args = (log as any).args;
  const {
    marketId,
    allowedModelIdx,
    trader,
    isBuy,
    tokensDelta,
    modelSharesDelta,
    modelNewPrice,
    modelNewSupply,
    marketNewSupply,
  } = args;

  const id = `${log.transactionHash}:${log.logIndex}`;
  const normalizedTrader = getAddress(trader);
  const mktId = BigInt(marketId.toString());
  const modelIdx = BigInt(allowedModelIdx.toString());
  const tokensStr = tokensDelta.toString();
  const sharesStr = modelSharesDelta.toString();
  const priceStr = modelNewPrice.toString();
  const impliedProb = priceToPercent(BigInt(priceStr));

  // Ensure market exists
  await prisma.market.upsert({
    where: { marketId: mktId },
    update: {
      totalTrades: { increment: 1 },
      totalVolume: {
        // Can't do BigInt addition in Prisma, will update separately
        set: undefined
      }
    },
    create: {
      marketId: mktId,
      status: 0,
      totalTrades: 1,
    },
  });

  // Insert trade
  await prisma.trade.upsert({
    where: { id },
    update: {},
    create: {
      id,
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex),
      blockNumber: BigInt(log.blockNumber!.toString()),
      blockTime,
      marketId: mktId,
      modelIdx,
      trader: normalizedTrader,
      isBuy: Boolean(isBuy),
      tokensDelta: tokensStr,
      sharesDelta: sharesStr,
      modelNewPrice: priceStr,
      modelNewSupply: modelNewSupply.toString(),
      marketNewSupply: marketNewSupply.toString(),
      impliedProbability: impliedProb,
    },
  });

  // Update trader stats
  await prisma.traderStats.upsert({
    where: { address: normalizedTrader },
    update: {
      totalTrades: { increment: 1 },
      buyCount: isBuy ? { increment: 1 } : undefined,
      sellCount: !isBuy ? { increment: 1 } : undefined,
      lastTradeAt: blockTime,
    },
    create: {
      address: normalizedTrader,
      totalTrades: 1,
      buyCount: isBuy ? 1 : 0,
      sellCount: !isBuy ? 1 : 0,
      firstTradeAt: blockTime,
      lastTradeAt: blockTime,
    },
  });

  // Save price snapshot periodically
  const blockNum = Number(log.blockNumber);
  if (blockNum % PRICE_SNAPSHOT_INTERVAL === 0) {
    await prisma.priceSnapshot.create({
      data: {
        marketId: mktId,
        modelIdx,
        price: priceStr,
        probability: impliedProb,
        timestamp: blockTime,
        blockNumber: BigInt(blockNum),
      },
    });
  }
}

async function handleWinnersSubmitted(
  prisma: PrismaClient,
  log: Log,
  blockTime: Date
) {
  const args = (log as any).args;
  const marketId = BigInt(args.marketId.toString());
  const winningModelIdx = BigInt(args.winningModelIdx.toString());

  await prisma.market.upsert({
    where: { marketId },
    update: {
      winningModelIdx,
      status: 2, // settled
      settledAt: blockTime,
    },
    create: {
      marketId,
      winningModelIdx,
      status: 2,
      settledAt: blockTime,
    },
  });

  console.log(`🏆 Market #${marketId} settled - Winner: Model ${winningModelIdx}`);
}

// ============================================
// MAIN INDEXER FUNCTION
// ============================================
export async function runIndexer(
  prisma: PrismaClient,
  options: {
    fromBlock?: bigint;
    toBlock?: bigint;
    batchSize?: number;
    onProgress?: (current: bigint, target: bigint) => void;
  } = {}
): Promise<{ indexed: number; lastBlock: bigint }> {
  const client = getClient();
  const batchSize = BigInt(options.batchSize || BATCH_SIZE);
  
  // Get current chain head
  const headBlock = await client.getBlockNumber();
  const targetBlock = options.toBlock ?? (headBlock - CONFIRMATIONS);
  
  // Get starting block
  let fromBlock: bigint;
  if (options.fromBlock !== undefined) {
    fromBlock = options.fromBlock;
  } else {
    const state = await prisma.indexerState.findUnique({ where: { id: "delphi" } });
    if (state) {
      fromBlock = BigInt(state.lastBlock.toString()) + 1n;
    } else {
      // Start from a reasonable block (adjust based on contract deployment)
      fromBlock = 0n;
    }
  }

  if (fromBlock > targetBlock) {
    console.log(`Already at block ${fromBlock}, head is ${targetBlock}`);
    return { indexed: 0, lastBlock: fromBlock - 1n };
  }

  console.log(`📡 Indexing from block ${fromBlock} to ${targetBlock}`);
  
  let totalIndexed = 0;
  let currentBlock = fromBlock;
  const blockTimestampCache = new Map<bigint, Date>();

  // Helper to get block timestamp
  const getBlockTime = async (blockNumber: bigint): Promise<Date> => {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    
    const block = await client.getBlock({ blockNumber });
    const time = toDate(block.timestamp);
    blockTimestampCache.set(blockNumber, time);
    return time;
  };

  while (currentBlock <= targetBlock) {
    const endBlock = currentBlock + batchSize - 1n > targetBlock 
      ? targetBlock 
      : currentBlock + batchSize - 1n;

    try {
      // Fetch all events in batch
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: currentBlock,
        toBlock: endBlock,
        events: [EVENT_NEW_MARKET, EVENT_TRADE_EXECUTED, EVENT_WINNERS],
      });

      // Process each log
      for (const log of logs) {
        const blockTime = await getBlockTime(log.blockNumber!);

        switch (log.eventName) {
          case "NewMarket":
            await handleNewMarket(prisma, log, blockTime);
            break;
          case "TradeExecuted":
            await handleTradeExecuted(prisma, log, blockTime);
            totalIndexed++;
            break;
          case "WinnersSubmitted":
            await handleWinnersSubmitted(prisma, log, blockTime);
            break;
        }
      }

      // Update indexer state
      await prisma.indexerState.upsert({
        where: { id: "delphi" },
        update: { 
          lastBlock: endBlock,
          lastBlockTime: logs.length > 0 ? await getBlockTime(endBlock) : undefined,
          lastError: null,
        },
        create: { 
          id: "delphi", 
          lastBlock: endBlock,
        },
      });

      if (logs.length > 0) {
        console.log(`  Blocks ${currentBlock}-${endBlock}: ${logs.length} events`);
      }

      options.onProgress?.(endBlock, targetBlock);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error indexing blocks ${currentBlock}-${endBlock}:`, errorMsg);
      
      await prisma.indexerState.upsert({
        where: { id: "delphi" },
        update: { lastError: errorMsg },
        create: { id: "delphi", lastBlock: currentBlock - 1n, lastError: errorMsg },
      });
      
      throw error;
    }

    currentBlock = endBlock + 1n;
    
    // Clear cache periodically to prevent memory issues
    if (blockTimestampCache.size > 1000) {
      blockTimestampCache.clear();
    }
  }

  console.log(`✅ Indexed ${totalIndexed} trades up to block ${targetBlock}`);
  return { indexed: totalIndexed, lastBlock: targetBlock };
}

// ============================================
// RECALCULATE TRADER STATS (for accuracy)
// ============================================
export async function recalculateTraderStats(prisma: PrismaClient): Promise<void> {
  console.log("🔄 Recalculating trader stats from all trades...");

  // Get all unique traders
  const traders = await prisma.trade.findMany({
    distinct: ['trader'],
    select: { trader: true },
  });

  for (const { trader } of traders) {
    // Get all trades for this trader
    const trades = await prisma.trade.findMany({
      where: { trader },
      orderBy: { blockTime: 'asc' },
      select: {
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        marketId: true,
        modelIdx: true,
        blockTime: true,
      },
    });

    let totalVolume = 0n;
    let buyCount = 0;
    let sellCount = 0;
    let realizedPnl = 0n;
    let totalCostBasis = 0n;

    // Track positions per market:model
    const positions = new Map<string, { shares: bigint; cost: bigint }>();

    for (const trade of trades) {
      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      totalVolume += tokens;

      if (trade.isBuy) {
        buyCount++;
        const key = `${trade.marketId}:${trade.modelIdx}`;
        const pos = positions.get(key) || { shares: 0n, cost: 0n };
        pos.shares += shares;
        pos.cost += tokens;
        positions.set(key, pos);
        totalCostBasis += tokens;
      } else {
        sellCount++;
        const key = `${trade.marketId}:${trade.modelIdx}`;
        const pos = positions.get(key) || { shares: 0n, cost: 0n };
        
        if (pos.shares > 0n) {
          const avgCost = pos.cost / pos.shares;
          const costRemoved = avgCost * shares;
          realizedPnl += tokens - costRemoved;
          pos.shares -= shares;
          pos.cost = pos.cost > costRemoved ? pos.cost - costRemoved : 0n;
          positions.set(key, pos);
        } else {
          realizedPnl += tokens;
        }
      }
    }

    // Update stats
    await prisma.traderStats.upsert({
      where: { address: trader },
      update: {
        totalTrades: trades.length,
        totalVolume: totalVolume.toString(),
        buyCount,
        sellCount,
        realizedPnl: realizedPnl.toString(),
        totalCostBasis: totalCostBasis.toString(),
        firstTradeAt: trades[0]?.blockTime,
        lastTradeAt: trades[trades.length - 1]?.blockTime,
      },
      create: {
        address: trader,
        totalTrades: trades.length,
        totalVolume: totalVolume.toString(),
        buyCount,
        sellCount,
        realizedPnl: realizedPnl.toString(),
        totalCostBasis: totalCostBasis.toString(),
        firstTradeAt: trades[0]?.blockTime,
        lastTradeAt: trades[trades.length - 1]?.blockTime,
      },
    });
  }

  console.log(`✅ Recalculated stats for ${traders.length} traders`);
}

// ============================================
// UPDATE MARKET VOLUMES
// ============================================
export async function updateMarketVolumes(prisma: PrismaClient): Promise<void> {
  const markets = await prisma.market.findMany({
    select: { marketId: true },
  });

  for (const { marketId } of markets) {
    const result = await prisma.trade.aggregate({
      where: { marketId },
      _sum: { tokensDelta: true },
      _count: true,
    });

    // Note: tokensDelta is stored as string, so sum won't work directly
    // We need to calculate manually
    const trades = await prisma.trade.findMany({
      where: { marketId },
      select: { tokensDelta: true },
    });

    let totalVolume = 0n;
    for (const t of trades) {
      totalVolume += BigInt(t.tokensDelta);
    }

    await prisma.market.update({
      where: { marketId },
      data: {
        totalVolume: totalVolume.toString(),
        totalTrades: trades.length,
      },
    });
  }
}
