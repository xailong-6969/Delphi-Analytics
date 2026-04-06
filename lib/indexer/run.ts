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
  console.log(`Delphi indexer

Usage:
  npm run indexer -- [options]

Options:
  --batch-size <n>   Override the indexing batch size
  --recalculate      Recalculate trader stats after indexing
  --update-volumes   Force volume refresh even when no new trades were indexed
  --help             Show this help message
`);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const batchSize = parseBatchSize();
  const shouldRecalculate = hasFlag("--recalculate");
  const shouldUpdateVolumes = hasFlag("--update-volumes");

  const result = await runIndexer(prisma, {
    ...(batchSize !== undefined ? { batchSize } : {}),
  });

  console.log(
    `Indexed ${result.indexed} new trades up to block ${result.lastBlock.toString()}.`
  );

  if (result.indexed > 0 || shouldUpdateVolumes || shouldRecalculate) {
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
    console.error("Indexer CLI failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
