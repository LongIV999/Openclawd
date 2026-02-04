import { Context } from "grammy";
import type { OpenClawConfig } from "../config/types.js";
import { getChildLogger } from "../logging.js";
import { ObsidianClient } from "../obsidian/client.js";

const logger = getChildLogger({ module: "telegram-obsidian-bridge" });

let obsidianClient: ObsidianClient | null = null;

function getObsidianClient(cfg: OpenClawConfig): ObsidianClient | null {
  if (obsidianClient) return obsidianClient;

  if (!cfg.obsidian) {
    logger.warn("Obsidian config is missing");
    return null;
  }

  obsidianClient = new ObsidianClient(cfg.obsidian);
  return obsidianClient;
}

export async function handleNoteCommand(ctx: Context, cfg: OpenClawConfig, content: string) {
  const client = getObsidianClient(cfg);
  if (!client) {
    return ctx.reply("Obsidian integration is not configured.");
  }

  try {
    await ctx.reply("Creating note...");
    const path = await client.createNote(content);
    await ctx.reply(`Note created: ${path}`);
  } catch (err: any) {
    logger.error(`Failed to create note: ${err.message}`);
    await ctx.reply(`Error creating note: ${err.message}`);
  }
}

export async function handleTaskCommand(ctx: Context, cfg: OpenClawConfig, content: string) {
  const client = getObsidianClient(cfg);
  if (!client) {
    return ctx.reply("Obsidian integration is not configured.");
  }

  try {
    const path = await client.appendTask(content);
    await ctx.reply(`Task added to ${path}`);
  } catch (err: any) {
    logger.error(`Failed to add task: ${err.message}`);
    await ctx.reply(`Error adding task: ${err.message}`);
  }
}

export async function handleIdeaCommand(ctx: Context, cfg: OpenClawConfig, content: string) {
  const client = getObsidianClient(cfg);
  if (!client) {
    return ctx.reply("Obsidian integration is not configured.");
  }

  try {
    const path = await client.appendIdea(content);
    await ctx.reply(`Idea captured in ${path}`);
  } catch (err: any) {
    logger.error(`Failed to capture idea: ${err.message}`);
    await ctx.reply(`Error capturing idea: ${err.message}`);
  }
}

export async function handleJournalCommand(ctx: Context, cfg: OpenClawConfig, content: string) {
  const client = getObsidianClient(cfg);
  if (!client) {
    return ctx.reply("Obsidian integration is not configured.");
  }

  try {
    const path = await client.appendJournal(content);
    await ctx.reply(`Journal entry added to ${path}`);
  } catch (err: any) {
    logger.error(`Failed to add journal entry: ${err.message}`);
    await ctx.reply(`Error adding journal entry: ${err.message}`);
  }
}
