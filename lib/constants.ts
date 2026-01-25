// Contract addresses
export const DELPHI_PROXY = "0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1" as const;
export const DELPHI_IMPL = "0xCaC4F41DF8188034Eb459Bb4c8FaEcd6EE369fdf" as const;

// Chain config
export const CHAIN_ID = 685685;
export const CHAIN_NAME = "Gensyn Testnet";
export const EXPLORER_URL = "https://gensyn-testnet.explorer.alchemy.com";
export const DELPHI_URL = "https://delphi.gensyn.ai";

// Token config
export const TOKEN_SYMBOL = "$TEST";
export const TOKEN_DECIMALS = 18;

// Market status
export const MARKET_STATUS = {
  ACTIVE: 0,
  PAUSED: 1,
  SETTLED: 2,
} as const;

// Helper links
export const LINKS = {
  explorer: EXPLORER_URL,
  delphi: DELPHI_URL,
  contract: `${EXPLORER_URL}/address/${DELPHI_PROXY}`,
  tx: (hash: string) => `${EXPLORER_URL}/tx/${hash}`,
  address: (addr: string) => `${EXPLORER_URL}/address/${addr}`,
};

// Model colors for charts (consistent)
export const MODEL_COLORS = [
  "#3B82F6", // blue
  "#F97316", // orange
  "#10B981", // green
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F59E0B", // amber
  "#EF4444", // red
  "#6366F1", // indigo
  "#84CC16", // lime
];
