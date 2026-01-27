// Delphi API Client - V10 (Multi-trader settled markets fix)
// - Tries multiple traders for closedMarketsWithWinners
// - Uses /user/{address}/activity for model names

const DELPHI_API_BASE = "https://delphi.gensyn.ai/api";

// ============================================
// Types
// ============================================

export interface MarketModel {
  idx: string;
  name: string;
  family: string;
  isWinner?: boolean;
}

export interface MarketData {
  marketId: string;
  title: string;
  status: "active" | "settled";
  models: MarketModel[];
  winningModelIdx?: string;
  winningModelName?: string;
}

// ============================================
// Permanent Cache for Settled Markets
// ============================================

interface SettledMarketInfo {
  marketId: string;
  marketName: string;
  winningModelIdx: string;
  winningModelName: string;
}

const settledMarketsCache: Map<string, SettledMarketInfo> = new Map();
let settledMarketsFetchAttempted = false;

// ============================================
// API Functions
// ============================================

// Fetch closed markets - TRY MULTIPLE TRADERS
async function fetchClosedMarketsWithWinners(traderAddresses: string[]): Promise<SettledMarketInfo[]> {
  const allMarkets = new Map<string, SettledMarketInfo>();
  
  // Try first 5 traders to get all settled markets
  for (let i = 0; i < Math.min(5, traderAddresses.length); i++) {
    const address = traderAddresses[i];
    try {
      const url = `${DELPHI_API_BASE}/user/${address}/closedMarketsWithWinners`;
      
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      
      if (!res.ok) continue;
      
      const json = await res.json();
      const data = json.data || json || [];
      
      if (!Array.isArray(data)) continue;
      
      for (const m of data) {
        const marketId = m.marketId?.toString() || "";
        if (marketId && !allMarkets.has(marketId)) {
          allMarkets.set(marketId, {
            marketId,
            marketName: m.marketName || "",
            winningModelIdx: m.winningModelIdx?.toString() || "0",
            winningModelName: m.winningModelName || "",
          });
          console.log(`  Market #${marketId}: Winner = ${m.winningModelName} (idx: ${m.winningModelIdx})`);
        }
      }
      
      // If we found markets, we can stop after first few traders
      if (allMarkets.size >= 2) break;
      
    } catch (e) {
      continue;
    }
  }
  
  return Array.from(allMarkets.values());
}

// Fetch user activity for a specific market
async function fetchUserActivityForMarket(
  address: string,
  marketId: string,
  limit = 500
): Promise<any[]> {
  try {
    const url = `${DELPHI_API_BASE}/user/${address}/activity?marketId=${marketId}&limit=${limit}`;
    
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    return [];
  }
}

// ============================================
// Helper
// ============================================

export function formatModelName(modelName?: string): string {
  if (!modelName) return "Unknown Model";
  return modelName.toUpperCase();
}

// ============================================
// Model Discovery
// ============================================

interface DiscoveredModels {
  [marketId: string]: MarketModel[];
}

interface MarketStatus {
  [marketId: string]: "active" | "settled";
}

async function discoverModelsAndStatus(
  traderAddresses: string[],
  marketIds: string[]
): Promise<{ models: DiscoveredModels; statuses: MarketStatus }> {
  const discovered: DiscoveredModels = {};
  const statuses: MarketStatus = {};
  const foundModels: { [marketId: string]: Set<string> } = {};

  for (const marketId of marketIds) {
    discovered[marketId] = [];
    foundModels[marketId] = new Set();
  }

  console.log(`🔍 Discovering models for markets: [${marketIds.join(", ")}]`);

  let totalApiCalls = 0;

  for (const marketId of marketIds) {
    console.log(`\n📊 Market #${marketId}:`);

    for (const address of traderAddresses) {
      if (foundModels[marketId].size >= 5) {
        console.log(`  ✅ Found ${foundModels[marketId].size} models`);
        break;
      }

      const activity = await fetchUserActivityForMarket(address, marketId, 500);
      totalApiCalls++;

      if (activity.length === 0) continue;

      // Get status from first item
      if (!statuses[marketId] && activity[0]) {
        statuses[marketId] = activity[0].is_market_closed ? "settled" : "active";
        console.log(`  📌 Status: ${statuses[marketId]}`);
      }

      let newModelsFound = 0;
      for (const item of activity) {
        const idx = item.allowed_model_idx?.toString();
        if (!idx || foundModels[marketId].has(idx)) continue;

        const modelName = item.model_name || "";
        if (!modelName) continue;

        foundModels[marketId].add(idx);
        discovered[marketId].push({
          idx,
          name: formatModelName(modelName),
          family: (item.model_family_name || "").toUpperCase(),
        });
        newModelsFound++;
      }

      if (newModelsFound > 0) {
        console.log(`  👤 ${address.slice(0, 10)}... → +${newModelsFound} models (total: ${foundModels[marketId].size})`);
      }

      await new Promise(r => setTimeout(r, 50));
    }

    if (foundModels[marketId].size === 0) {
      console.log(`  ⚠️ No activity found`);
    }
  }

  console.log(`\n📈 Total API calls: ${totalApiCalls}`);

  // Sort models by index
  for (const marketId of marketIds) {
    discovered[marketId].sort((a, b) => parseInt(a.idx) - parseInt(b.idx));
  }

  return { models: discovered, statuses };
}

// ============================================
// Cache for model discovery (1 hour)
// ============================================

let cachedModelData: { models: DiscoveredModels; statuses: MarketStatus } | null = null;
let modelCacheTimestamp = 0;
const MODEL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ============================================
// Main Export
// ============================================

export async function fetchAllMarketsWithModels(
  topTraders: string[]
): Promise<{
  active: MarketData[];
  settled: MarketData[];
}> {
  try {
    if (!topTraders || topTraders.length === 0) {
      console.error("❌ No traders provided");
      return { active: [], settled: [] };
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`🚀 fetchAllMarketsWithModels - ${topTraders.length} traders`);

    // Step 1: Fetch settled markets info (with correct winners)
    // Try multiple traders to find all settled markets
    if (!settledMarketsFetchAttempted || settledMarketsCache.size === 0) {
      console.log("🏆 Fetching settled markets with winners...");
      const closedMarkets = await fetchClosedMarketsWithWinners(topTraders);
      
      for (const market of closedMarkets) {
        settledMarketsCache.set(market.marketId, market);
      }
      settledMarketsFetchAttempted = true;
      console.log(`  Found ${settledMarketsCache.size} settled markets`);
    } else {
      console.log("📦 Using cached settled markets info");
    }

    // Step 2: Get all market IDs (settled + known active)
    const settledIds = Array.from(settledMarketsCache.keys());
    // Market 3 is active, market 2 doesn't exist
    // Also check markets 0, 1 in case they weren't found via API
    const knownMarketIds = ["0", "1", "3"];
    const allMarketIds = [...new Set([...settledIds, ...knownMarketIds])];

    // Step 3: Discover models (cached for 1 hour)
    const now = Date.now();
    let discoveredModels: DiscoveredModels;
    let marketStatuses: MarketStatus;

    if (cachedModelData && (now - modelCacheTimestamp) < MODEL_CACHE_TTL) {
      console.log("📦 Using cached model data");
      discoveredModels = cachedModelData.models;
      marketStatuses = cachedModelData.statuses;
    } else {
      console.log("🔄 Discovering models...");
      const result = await discoverModelsAndStatus(topTraders, allMarketIds);
      discoveredModels = result.models;
      marketStatuses = result.statuses;

      cachedModelData = result;
      modelCacheTimestamp = now;
    }

    // Step 4: Build response
    const active: MarketData[] = [];
    const settled: MarketData[] = [];

    for (const marketId of allMarketIds) {
      const models = discoveredModels[marketId] || [];
      if (models.length === 0) continue;

      const settledInfo = settledMarketsCache.get(marketId);
      const isSettled = !!settledInfo || marketStatuses[marketId] === "settled";

      if (isSettled) {
        // SETTLED MARKET
        const winningIdx = settledInfo?.winningModelIdx || "0";
        const winningName = settledInfo?.winningModelName 
          ? formatModelName(settledInfo.winningModelName)
          : models.find(m => m.idx === winningIdx)?.name || "Unknown";

        const modelsWithWinner = models.map(m => ({
          ...m,
          isWinner: m.idx === winningIdx,
        }));

        settled.push({
          marketId,
          title: settledInfo?.marketName || `Gensyn Middleweight General Reasoning Benchmark`,
          status: "settled",
          models: modelsWithWinner,
          winningModelIdx: winningIdx,
          winningModelName: winningName,
        });
      } else {
        // ACTIVE MARKET
        active.push({
          marketId,
          title: `Gensyn Lightweight General Reasoning Benchmark`,
          status: "active",
          models,
        });
      }
    }

    // Sort by marketId desc
    active.sort((a, b) => parseInt(b.marketId) - parseInt(a.marketId));
    settled.sort((a, b) => parseInt(b.marketId) - parseInt(a.marketId));

    console.log(`✅ Returning ${active.length} active, ${settled.length} settled`);

    return { active, settled };
  } catch (error) {
    console.error("❌ Error:", error);
    return { active: [], settled: [] };
  }
}
