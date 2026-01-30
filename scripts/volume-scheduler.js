const http = require("http");

// Call the cron API - this handles all updates including market volumes
async function callCronAPI() {
    const secret = process.env.CRON_SECRET || "delphi-cron-2024";
    const url = `http://localhost:3000/api/cron?secret=${secret}`;

    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`🔄 Cron result: indexed ${json.indexed || 0} trades`);
                } catch (e) {
                    console.log(`🔄 Cron called (status: ${res.statusCode})`);
                }
                resolve();
            });
        }).on("error", (e) => {
            console.log(`⚠️ Cron call failed: ${e.message}`);
            resolve();
        });
    });
}

// Main scheduler - only calls cron API, no separate Prisma connection
async function runScheduler() {
    console.log("🚀 Cron scheduler started");

    // Wait for Next.js server to start
    await new Promise(r => setTimeout(r, 10000));

    // Initial call
    console.log("📊 Running initial cron...");
    await callCronAPI();

    // Run every 2 minutes (120 seconds) to reduce connection pressure
    const INTERVAL_MS = 120 * 1000;
    console.log(`⏰ Scheduling cron every ${INTERVAL_MS / 1000} seconds`);

    setInterval(async () => {
        try {
            await callCronAPI();
        } catch (e) {
            console.error("Scheduler error:", e.message);
        }
    }, INTERVAL_MS);
}

// Run on module load
runScheduler().catch(console.error);
