import prisma from "../prisma";
import { recalculateTraderStats, runIndexer, updateMarketVolumes } from "./core";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseBigIntArg(flag: string, required = false): bigint | undefined {
  const rawValue = getArgValue(flag);

  if (!rawValue) {
    if (required) {
      throw new Error(`Missing required ${flag} value.`);
    }
    return undefined;
  }

  try {
    return BigInt(rawValue);
  } catch {
    throw new Error(`Invalid ${flag} value: ${rawValue}`);
  }
}

function parseBatchSize(): number | undefined {
  const rawValue = getArgValue("--batch-size");
  if (!rawValue) return undefined;

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --batch-size value: ${rawValue}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Delphi indexer backfill

Usage:
  npm run indexer:backfill -- --from-block <block> [options]

Options:
  --from-block <n>   Required start block for the backfill range
  --to-block <n>     Optional inclusive end block
  --batch-size <n>   Override the indexing batch size
  --recalculate      Recalculate trader stats after the backfill
  --skip-volumes     Skip the post-backfill volume refresh
  --help             Show this help message
`);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const fromBlock = parseBigIntArg("--from-block", true)!;
  const toBlock = parseBigIntArg("--to-block");
  const batchSize = parseBatchSize();
  const shouldRecalculate = hasFlag("--recalculate");
  const shouldSkipVolumes = hasFlag("--skip-volumes");

  const previousState = await prisma.indexerState.findUnique({
    where: { id: "delphi" },
    select: { lastBlock: true },
  });

  const result = await runIndexer(prisma, {
    fromBlock,
    ...(toBlock !== undefined ? { toBlock } : {}),
    ...(batchSize !== undefined ? { batchSize } : {}),
  });

  console.log(
    `Backfilled ${result.indexed} trades across ${fromBlock.toString()}-${result.lastBlock.toString()}.`
  );

  if (
    previousState?.lastBlock !== undefined &&
    previousState.lastBlock > result.lastBlock
  ) {
    await prisma.indexerState.upsert({
      where: { id: "delphi" },
      update: {
        lastBlock: previousState.lastBlock,
        updatedAt: new Date(),
        isRunning: false,
      },
      create: {
        id: "delphi",
        lastBlock: previousState.lastBlock,
        isRunning: false,
      },
    });

    console.log(
      `Preserved indexer cursor at block ${previousState.lastBlock.toString()}.`
    );
  }

  if (!shouldSkipVolumes) {
    await updateMarketVolumes(prisma);
    console.log("Updated market volumes.");
  }

  if (shouldRecalculate) {
    const updatedTraders = await recalculateTraderStats(prisma);
    console.log(`Recalculated trader stats for ${updatedTraders} traders.`);
  }
}

main()
  .catch((error) => {
    console.error("Indexer backfill CLI failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
