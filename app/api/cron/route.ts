import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runIndexer, recalculateTraderStats, updateMarketVolumes } from "@/lib/indexer/core";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

// This endpoint can be called by:
// 1. Railway Cron job
// 2. External cron service (cron-job.org, etc.)
// 3. Vercel Cron (if deployed there)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
  const expectedSecret = process.env.INDEXER_SECRET || process.env.CRON_SECRET;
  
  // Verify secret
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  
  try {
    // Run the indexer
    console.log("🚀 Cron: Starting indexer...");
    const result = await runIndexer(prisma, {
      batchSize: 2000,
    });

    // If we indexed new trades, recalculate stats
    if (result.indexed > 0) {
      console.log("📊 Cron: Updating trader stats...");
      await recalculateTraderStats(prisma);
      await updateMarketVolumes(prisma);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Cron completed in ${duration}ms - indexed ${result.indexed} trades`);

    return NextResponse.json({
      success: true,
      indexed: result.indexed,
      lastBlock: result.lastBlock.toString(),
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Cron error:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
