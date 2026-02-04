
import { loadConfig } from "../src/config/io.js";
import { resolveTelegramToken } from "../src/telegram/token.js";
import { probeTelegram } from "../src/telegram/probe.js";

async function run() {
    console.log("Loading configuration...");
    const config = loadConfig();
    const tokenResolution = resolveTelegramToken(config);

    if (!tokenResolution.token) {
        console.error("❌ Telegram token not found in config or environment.");
        console.log("Please set TELEGRAM_BOT_TOKEN environment variable or configure channels.telegram.botToken");
        process.exit(1);
    }

    console.log(`Checking connection for token (source: ${tokenResolution.source})...`);

    // Use proxy if configured
    const proxy = config.channels?.telegram?.proxy;

    const result = await probeTelegram(tokenResolution.token, 10000, proxy);

    if (result.ok) {
        console.log("✅ Connection successful!");
        console.log("Bot info:", result.bot);
        if (result.webhook) {
            console.log("Webhook info:", result.webhook);
        }
    } else {
        console.error("❌ Connection failed.");
        console.error("Error:", result.error);
        console.error("Status:", result.status);
    }
}

run().catch(err => {
    console.error("Script error:", err);
    process.exit(1);
});
