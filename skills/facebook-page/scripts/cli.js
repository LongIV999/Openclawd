#!/usr/bin/env node
/**
 * Facebook Page CLI
 * Commands for managing Facebook Pages via Graph API
 */

import { program } from "commander";
import { readFileSync, existsSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { Blob } from "buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, "..");
const ENV_FILE = join(SKILL_DIR, ".env");
const TOKENS_FILE = join(SKILL_DIR, "tokens.json");

// Load .env from skill directory
config({ path: ENV_FILE });

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function loadTokens() {
  if (!existsSync(TOKENS_FILE)) {
    console.error(`Error: No tokens found at ${TOKENS_FILE}`);
    console.error("Run: node auth.js login");
    process.exit(1);
  }
  return JSON.parse(readFileSync(TOKENS_FILE, "utf-8"));
}

function getPageToken(tokens, pageId) {
  const pages = tokens.pages || {};
  if (!pages[pageId]) {
    console.error(`Error: Page ${pageId} not found in tokens`);
    console.error("Available pages:");
    for (const [pid, pinfo] of Object.entries(pages)) {
      console.log(`  ${pid}: ${pinfo.name}`);
    }
    process.exit(1);
  }
  return pages[pageId].token;
}

async function apiGet(endpoint, token, params = {}) {
  const url = new URL(`${GRAPH_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  
  const resp = await fetch(url);
  const data = await resp.json();
  if (!resp.ok) {
    console.error(`API Error: ${resp.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

async function apiPost(endpoint, token, body = {}) {
  const url = new URL(`${GRAPH_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", token);
  
  const formData = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    formData.set(k, v);
  }
  
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });
  
  const data = await resp.json();
  if (!resp.ok) {
    console.error(`API Error: ${resp.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

async function apiPostMultipart(endpoint, token, fields, filePath) {
  const url = new URL(`${GRAPH_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", token);
  
  const fileBuffer = readFileSync(filePath);
  const formData = new FormData();
  
  for (const [k, v] of Object.entries(fields)) {
    formData.set(k, v);
  }
  
  formData.set("source", new Blob([fileBuffer]), basename(filePath));
  
  const resp = await fetch(url, {
    method: "POST",
    body: formData,
  });
  
  const data = await resp.json();
  if (!resp.ok) {
    console.error(`API Error: ${resp.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

async function apiDelete(endpoint, token) {
  const url = new URL(`${GRAPH_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", token);
  
  const resp = await fetch(url, { method: "DELETE" });
  const data = await resp.json();
  if (!resp.ok) {
    console.error(`API Error: ${resp.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

// ============ PAGES ============

program
  .command("pages")
  .description("List pages you manage")
  .action(() => {
    const tokens = loadTokens();
    const pages = tokens.pages || {};
    
    if (!Object.keys(pages).length) {
      console.log("No pages found");
      return;
    }
    
    console.log(`${"ID".padEnd(20)} ${"Name".padEnd(40)}`);
    console.log("-".repeat(60));
    for (const [pageId, pageInfo] of Object.entries(pages)) {
      console.log(`${pageId.padEnd(20)} ${pageInfo.name.padEnd(40)}`);
    }
  });

// ============ POSTS ============

const postCmd = program.command("post").description("Post operations");

postCmd
  .command("list")
  .description("List posts from a page")
  .requiredOption("--page <id>", "Page ID")
  .option("--limit <n>", "Number of posts", "10")
  .action(async (opts) => {
    const tokens = loadTokens();
    const pageToken = getPageToken(tokens, opts.page);
    
    const result = await apiGet(`${opts.page}/posts`, pageToken, {
      fields: "id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)",
      limit: opts.limit,
    });
    
    const posts = result.data || [];
    if (!posts.length) {
      console.log("No posts found");
      return;
    }
    
    for (const post of posts) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`ID: ${post.id}`);
      console.log(`Date: ${post.created_time || "N/A"}`);
      console.log(`Message: ${(post.message || "(no text)").slice(0, 100)}...`);
      const likes = post.likes?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;
      console.log(`Likes: ${likes} | Comments: ${comments} | Shares: ${shares}`);
      console.log(`URL: ${post.permalink_url || "N/A"}`);
    }
  });

postCmd
  .command("create")
  .description("Create a new post")
  .requiredOption("--page <id>", "Page ID")
  .option("--message <text>", "Post message")
  .option("--photo <path>", "Path to photo file")
  .option(
    "--photos <paths>",
    "Comma-separated photo paths for a multi-image (carousel) post. Example: a.jpg,b.jpg,c.jpg"
  )
  .option("--link <url>", "URL to share")
  .action(async (opts) => {
    const tokens = loadTokens();
    const pageToken = getPageToken(tokens, opts.page);

    let result;

    if (opts.photos) {
      // Multi-image (carousel) post
      if (!opts.message) {
        console.error("Error: --message is required for multi-image posts");
        process.exit(1);
      }

      const paths = String(opts.photos)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      if (paths.length < 2) {
        console.error("Error: --photos must include at least 2 image paths");
        process.exit(1);
      }

      // 1) Upload each photo as unpublished
      const mediaIds = [];
      for (const p of paths) {
        const fields = { published: "false" };
        const up = await apiPostMultipart(`${opts.page}/photos`, pageToken, fields, p);
        if (!up.id) {
          console.error("Error: upload did not return photo id");
          process.exit(1);
        }
        mediaIds.push(up.id);
      }

      // 2) Create feed post with attached_media
      const body = { message: opts.message };
      mediaIds.forEach((id, idx) => {
        body[`attached_media[${idx}]`] = JSON.stringify({ media_fbid: id });
      });

      result = await apiPost(`${opts.page}/feed`, pageToken, body);
    } else if (opts.photo) {
      // Single photo post
      const fields = {};
      if (opts.message) fields.message = opts.message;
      result = await apiPostMultipart(`${opts.page}/photos`, pageToken, fields, opts.photo);
    } else if (opts.link) {
      // Link post
      const body = { link: opts.link };
      if (opts.message) body.message = opts.message;
      result = await apiPost(`${opts.page}/feed`, pageToken, body);
    } else {
      // Text post
      if (!opts.message) {
        console.error("Error: --message is required for text posts");
        process.exit(1);
      }
      result = await apiPost(`${opts.page}/feed`, pageToken, { message: opts.message });
    }

    console.log(`Post created! ID: ${result.id || result.post_id}`);
  });

postCmd
  .command("delete")
  .description("Delete a post")
  .requiredOption("--page <id>", "Page ID")
  .requiredOption("--post <id>", "Post ID")
  .action(async (opts) => {
    const tokens = loadTokens();
    const pageToken = getPageToken(tokens, opts.page);
    
    const result = await apiDelete(opts.post, pageToken);
    if (result.success) {
      console.log("Post deleted successfully");
    } else {
      console.log("Failed to delete post");
    }
  });

// ============ COMMENTS ============

const commentsCmd = program.command("comments").description("Comment operations");

commentsCmd
  .command("create")
  .description("Create a comment on a post")
  .requiredOption("--post <id>", "Post ID")
  .requiredOption("--message <text>", "Comment message")
  .option(
    "--page <id>",
    "Page ID to comment as the Page (uses stored page token). If omitted, uses user token."
  )
  .action(async (opts) => {
    const tokens = loadTokens();
    const token = opts.page ? getPageToken(tokens, opts.page) : tokens.user_token;

    const result = await apiPost(`${opts.post}/comments`, token, {
      message: opts.message,
    });
    console.log(`Comment posted! ID: ${result.id}`);
  });

commentsCmd
  .command("list")
  .description("List comments on a post")
  .requiredOption("--post <id>", "Post ID")
  .option("--limit <n>", "Number of comments", "25")
  .action(async (opts) => {
    const tokens = loadTokens();
    const userToken = tokens.user_token;
    
    const result = await apiGet(`${opts.post}/comments`, userToken, {
      fields: "id,message,from,created_time,like_count,is_hidden",
      limit: opts.limit,
    });
    
    const comments = result.data || [];
    if (!comments.length) {
      console.log("No comments found");
      return;
    }
    
    for (const comment of comments) {
      const hidden = comment.is_hidden ? " [HIDDEN]" : "";
      console.log(`\n${"-".repeat(40)}`);
      console.log(`ID: ${comment.id}${hidden}`);
      console.log(`From: ${comment.from?.name || "Unknown"}`);
      console.log(`Date: ${comment.created_time || "N/A"}`);
      console.log(`Likes: ${comment.like_count || 0}`);
      console.log(`Message: ${comment.message || ""}`);
    }
  });

commentsCmd
  .command("reply")
  .description("Reply to a comment")
  .requiredOption("--comment <id>", "Comment ID")
  .requiredOption("--message <text>", "Reply message")
  .action(async (opts) => {
    const tokens = loadTokens();
    const userToken = tokens.user_token;
    
    const result = await apiPost(`${opts.comment}/comments`, userToken, {
      message: opts.message,
    });
    console.log(`Reply posted! ID: ${result.id}`);
  });

commentsCmd
  .command("hide")
  .description("Hide a comment")
  .requiredOption("--comment <id>", "Comment ID")
  .action(async (opts) => {
    const tokens = loadTokens();
    const userToken = tokens.user_token;
    
    const result = await apiPost(opts.comment, userToken, { is_hidden: "true" });
    if (result.success) {
      console.log("Comment hidden successfully");
    } else {
      console.log("Failed to hide comment");
    }
  });

commentsCmd
  .command("unhide")
  .description("Unhide a comment")
  .requiredOption("--comment <id>", "Comment ID")
  .action(async (opts) => {
    const tokens = loadTokens();
    const userToken = tokens.user_token;
    
    const result = await apiPost(opts.comment, userToken, { is_hidden: "false" });
    if (result.success) {
      console.log("Comment unhidden successfully");
    } else {
      console.log("Failed to unhide comment");
    }
  });

commentsCmd
  .command("delete")
  .description("Delete a comment")
  .requiredOption("--comment <id>", "Comment ID")
  .action(async (opts) => {
    const tokens = loadTokens();
    const userToken = tokens.user_token;
    
    const result = await apiDelete(opts.comment, userToken);
    if (result.success) {
      console.log("Comment deleted successfully");
    } else {
      console.log("Failed to delete comment");
    }
  });

program.parse();
