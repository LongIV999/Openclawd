#!/usr/bin/env node
/**
 * PKM Automation Script for Obsidian
 * Refactored to use ObsidianClient
 */

import { createConfigIO } from "../../../src/config/io.js";
import { ObsidianClient } from "../../../src/obsidian/client.js";
import { basename, join } from "node:path";

// Initialize client
async function initClient(): Promise<ObsidianClient> {
    const configPath = join(process.cwd(), "settings.json");
    try {
        const io = createConfigIO({ configPath });
        const config = io.loadConfig();

        if (!config.obsidian) {
            console.error("❌ Obsidian configuration not found in settings.json");
            process.exit(1);
        }
        return new ObsidianClient(config.obsidian);
    } catch (error) {
        console.error("❌ Failed to load configuration:", error);
        process.exit(1);
    }
}

// CLI
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

async function main() {
    const client = await initClient();

    switch (command) {
        case "daily-note":
            try {
                const path = await client.createDailyNote();
                console.log(`✅ Created daily note: ${path}`);
                // Optional: open logic could be added to client or here
            } catch (error) {
                console.error("❌ Failed to create daily note:", error);
            }
            break;

        case "note":
            if (!arg1) {
                console.error("Please provide content for the note.");
                process.exit(1);
            }
            try {
                const path = await client.createNote(arg1, "Inbox", arg2); // content, folder, title
                console.log(`✅ Note created: ${path}`);
            } catch (error) {
                console.error("❌ Failed to create note:", error);
            }
            break;

        case "auto-link":
            try {
                console.log("🔍 Scanning notes for link opportunities...");
                const count = await client.autoLink();
                console.log(`✅ Found ${count} link opportunities`);
            } catch (error) {
                console.error("❌ Auto-link failed:", error);
            }
            break;

        case "auto-tag":
            try {
                console.log("🏷️ Auto-tagging notes...");
                const tagged = await client.autoTag(arg1); // optional specific note path
                if (tagged.length > 0) {
                    console.log(`✅ Auto-tagged ${tagged.length} notes:`);
                    tagged.forEach(t => console.log(`  - ${basename(t)}`));
                } else {
                    console.log("ℹ️ No new tags applied.");
                }
            } catch (error) {
                console.error("❌ Auto-tag failed:", error);
            }
            break;

        default:
            console.log(`
PKM Automation Commands (via ObsidianClient):

  daily-note              Create daily note
  note <content> [title]  Create a quick note
  auto-link               Find and suggest backlinks
  auto-tag [note]         Auto-tag notes

Example:
  pnpm tsx skills/obsidian/scripts/pkm-automation.ts daily-note
            `);
    }
}

main().catch(console.error);
