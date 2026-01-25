# Delphi Analytics

A comprehensive analytics dashboard for [Delphi prediction markets](https://delphi.gensyn.ai) on Gensyn Testnet.

![Delphi Analytics](https://img.shields.io/badge/Gensyn-Testnet-blue)

## Features

- 📊 **Market Analytics** - View all active and settled prediction markets with model details
- 📈 **Price Charts** - Historical win probability charts for each model
- 🏆 **Leaderboard** - Top traders ranked by volume and P&L
- 💰 **P&L Tracking** - Full realized P&L calculation from ALL trades
- 🔍 **Wallet Search** - Search any wallet to see their trading history
- ⚡ **Real-time Indexing** - Automated blockchain event indexing

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, Recharts
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: viem for RPC interactions
- **Deployment**: Railway (single deployment)

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/delphi-analytics)

### Manual Railway Setup

1. Create a new project on [Railway](https://railway.app)

2. Add a PostgreSQL database:
   - Click "New" → "Database" → "PostgreSQL"

3. Deploy from GitHub:
   - Click "New" → "GitHub Repo"
   - Select your repository

4. Set environment variables in Railway:
   ```
   RPC_URL=https://gensyn-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
   INDEXER_SECRET=your-secret-key-here
   ```

5. The app will automatically:
   - Install dependencies
   - Generate Prisma client
   - Run database migrations
   - Build and start the app

## Running the Indexer

The indexer runs via API endpoints. You have several options:

### Option 1: Manual Trigger
```bash
# Index new blocks
curl "https://your-app.railway.app/api/indexer?secret=YOUR_SECRET&action=index"

# Recalculate all trader stats
curl "https://your-app.railway.app/api/indexer?secret=YOUR_SECRET&action=recalculate"

# Check status
curl "https://your-app.railway.app/api/indexer?secret=YOUR_SECRET&action=status"
```

### Option 2: Railway Cron (Recommended)
Add a cron job in Railway to call the endpoint every 5 minutes:
```
*/5 * * * * curl -s "https://your-app.railway.app/api/cron?secret=YOUR_SECRET"
```

### Option 3: External Cron Service
Use [cron-job.org](https://cron-job.org) or similar to call:
```
GET https://your-app.railway.app/api/cron?secret=YOUR_SECRET
```

## Local Development

1. Clone and install:
```bash
git clone https://github.com/yourusername/delphi-analytics.git
cd delphi-analytics
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Set up database:
```bash
# Start PostgreSQL (Docker example)
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres

# Push schema
npx prisma db push

# Optional: Open Prisma Studio
npx prisma studio
```

4. Run the development server:
```bash
npm run dev
```

5. Run the indexer manually:
```bash
npm run indexer
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Global statistics |
| `GET /api/markets` | List all markets |
| `GET /api/markets/[id]` | Single market with price history |
| `GET /api/leaderboard` | Top traders |
| `GET /api/address/[addr]/stats` | Wallet statistics |
| `GET /api/address/[addr]/trades` | Wallet trade history |
| `GET /api/address/[addr]/positions` | Wallet positions |
| `GET /api/indexer` | Trigger indexer (requires secret) |
| `GET /api/cron` | Cron endpoint for scheduled indexing |

## Contract Details

- **Proxy**: `0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1`
- **Implementation**: `0xCaC4F41DF8188034Eb459Bb4c8FaEcd6EE369fdf`
- **Chain**: Gensyn Testnet (Chain ID: 685685)

## Events Indexed

1. `NewMarket` - New prediction market created
2. `TradeExecuted` - Buy/sell trades with price updates
3. `WinnersSubmitted` - Market settlement with winner

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT License - see [LICENSE](LICENSE)

---

Built with ❤️ by **xailong_6969** for the Gensyn community
