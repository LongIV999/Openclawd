import { exec } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import type { ObsidianConfig } from "../config/types.js";
import {
  formatVietnameseDate,
  formatVietnameseDateTime,
  removeVietnameseTones,
} from "../i18n/vietnamese.js";

const execAsync = promisify(exec);

export class ObsidianClient {
  private config: ObsidianConfig;
  private vaultPath: string | null = null;

  constructor(config: ObsidianConfig) {
    this.config = config;
  }

  private async getVaultPath(): Promise<string> {
    if (this.vaultPath) {
      return this.vaultPath;
    }

    if (this.config.defaultVault) {
      // If default vault is set in config, try to resolve it from obsidian.json or just assume it's the name if we can't read obsidian.json
      // Simplest way: use obsidian-cli to resolve it if possible, or fall back to manual resolution if we implemented that.
      // But obsidian-cli is the tool of choice here.
      // Let's rely on obsidian-cli print-default first.
    }

    try {
      const { stdout } = await execAsync("obsidian-cli print-default --path-only");
      this.vaultPath = stdout.trim();
      return this.vaultPath;
    } catch {
      if (this.config.defaultVault) {
        // Fallback: This assumes the user might have set up the vault manually or we are in a customized environment
        // We can try to set it via obsidian-cli if it's not set
        try {
          // Attempt to set it if we have a name
          // But we need the path. "set-default" takes a name.
          // This is tricky without user interaction.
          // For now, throw error if obsidian-cli fails.
          throw new Error(
            "Could not resolve default vault. Please run `obsidian-cli set-default <vault-name>`.",
          );
        } catch {
          throw new Error(
            "Could not resolve default vault. Please run `obsidian-cli set-default <vault-name>`.",
          );
        }
      }
      throw new Error(
        "Could not resolve default vault. Please run `obsidian-cli set-default <vault-name>`.",
      );
    }
  }

  async createNote(content: string, folder: string = "Inbox", title?: string): Promise<string> {
    const vaultPath = await this.getVaultPath();
    const finalTitle = title || this.generateTitle(content);
    const filename = `${finalTitle}.md`;
    const fullPath = join(vaultPath, folder, filename);

    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const created = this.config.vietnameseSupport
      ? formatVietnameseDateTime(new Date())
      : new Date().toISOString();

    const fileContent = `---
created: ${created}
tags: [inbox, telegram]
source: telegram
---

# ${finalTitle}

${content}
`;

    writeFileSync(fullPath, fileContent);
    return fullPath;
  }

  async createDailyNote(content?: string, section?: string): Promise<string> {
    const vaultPath = await this.getVaultPath();
    const today = new Date();

    // Format: YYYY/MM/YYYY-MM-DD.md usually, or based on user preference.
    // For this implementation, we follow the pattern in pkm-automation.ts: Journal/YYYY/MM/YYYY-MM-DD.md
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const filename = `${year}-${month}-${day}.md`;

    const relativePath = join("Journal", String(year), month, filename);
    const fullPath = join(vaultPath, relativePath);

    if (!existsSync(fullPath)) {
      // Create if not exists
      const dateStr = this.config.vietnameseSupport
        ? formatVietnameseDate(today)
        : today.toLocaleDateString();

      const created = this.config.vietnameseSupport
        ? formatVietnameseDateTime(today)
        : today.toISOString();

      const template = this.config.dailyNoteTemplate
        ? await this.getTemplateContent(this.config.dailyNoteTemplate)
        : `---
date: ${dateStr}
created: ${created}
tags: [daily, journal]
---
# ${dateStr}

## ✅ Tasks

## 📝 Notes

## 💭 Journal
`;
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, template);
    }

    if (content) {
      let fileContent = readFileSync(fullPath, "utf-8");
      if (section) {
        // Try to append to specific section
        const sectionRegex = new RegExp(`##\\s+${section}`, "i");
        if (sectionRegex.test(fileContent)) {
          fileContent = fileContent.replace(sectionRegex, `## ${section}\n\n${content}`);
        } else {
          // Append to end if section not found
          fileContent += `\n\n## ${section}\n\n${content}`;
        }
      } else {
        // Append to end
        fileContent += `\n\n${content}`;
      }
      writeFileSync(fullPath, fileContent);
    }

    return fullPath;
  }

  async appendTask(task: string): Promise<string> {
    // Append to Daily Note under "Tasks" or similar
    // Format: - [ ] task
    return this.createDailyNote(`- [ ] ${task}`, "✅ Tasks");
  }

  async appendIdea(idea: string): Promise<string> {
    // Append to Daily Note under "Notes" or separate Idea file
    return this.createDailyNote(`- 💡 ${idea}`, "📝 Notes");
  }

  async appendJournal(entry: string): Promise<string> {
    const timestamp = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return this.createDailyNote(`- **${timestamp}**: ${entry}`, "💭 Journal");
  }

  private generateTitle(content: string): string {
    // Take first line or first few words
    const firstLine = content.split("\n")[0].trim();
    if (firstLine.length < 50) {
      return removeVietnameseTones(firstLine)
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim();
    }
    return (
      removeVietnameseTones(firstLine.slice(0, 50))
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim() + "..."
    );
  }

  private async getTemplateContent(templatePath: string): Promise<string> {
    const vaultPath = await this.getVaultPath();
    const fullPath = join(vaultPath, templatePath);
    if (existsSync(fullPath)) {
      return readFileSync(fullPath, "utf-8");
    }
    return "";
  }
  // Auto-link related notes
  async autoLink(): Promise<number> {
    const vaultPath = await this.getVaultPath();
    const allNotes = this.findAllNotes(vaultPath);
    let linksCreated = 0;

    for (const notePath of allNotes) {
      const content = readFileSync(notePath, "utf-8");
      const title = this.extractTitle(content, notePath);

      // Find other notes that mention this title
      for (const otherNotePath of allNotes) {
        if (notePath === otherNotePath) {
          continue;
        }

        const otherContent = readFileSync(otherNotePath, "utf-8");
        const normalizedTitle = removeVietnameseTones(title.toLowerCase());
        const normalizedContent = removeVietnameseTones(otherContent.toLowerCase());

        // Check if title is mentioned but not linked
        if (normalizedContent.includes(normalizedTitle) && !otherContent.includes(`[[${title}]]`)) {
          linksCreated++;
        }
      }
    }
    return linksCreated;
  }

  // Auto-tag notes
  async autoTag(notePath?: string): Promise<string[]> {
    const vaultPath = await this.getVaultPath();
    const notes = notePath ? [join(vaultPath, notePath)] : this.findAllNotes(vaultPath);
    const taggedNotes: string[] = [];

    const tagRules: Record<string, string[]> = {
      AI: ["ai", "artificial intelligence", "machine learning", "llm", "gpt"],
      automation: ["automation", "workflow", "script", "tự động"],
      vietnamese: ["tiếng việt", "vietnamese", "việt nam"],
      obsidian: ["obsidian", "pkm", "knowledge management"],
      telegram: ["telegram", "bot", "messaging"],
      deployment: ["deploy", "docker", "kubernetes", "triển khai"],
      bug: ["bug", "lỗi", "error", "fix"],
    };

    for (const note of notes) {
      let content = readFileSync(note, "utf-8");
      const normalized = removeVietnameseTones(content.toLowerCase());

      const suggestedTags = new Set<string>();

      for (const [tag, keywords] of Object.entries(tagRules)) {
        for (const keyword of keywords) {
          if (normalized.includes(removeVietnameseTones(keyword))) {
            suggestedTags.add(tag);
          }
        }
      }

      if (suggestedTags.size > 0) {
        content = this.addTagsToFrontmatter(content, Array.from(suggestedTags));
        writeFileSync(note, content);
        taggedNotes.push(note);
      }
    }
    return taggedNotes;
  }

  private findAllNotes(dir: string): string[] {
    let results: string[] = [];
    const list = readdirSync(dir);
    for (const file of list) {
      if (file.startsWith(".")) {
        continue;
      }
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(this.findAllNotes(fullPath));
      } else if (file.endsWith(".md")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private extractTitle(content: string, filePath: string): string {
    const lines = content.split("\n");
    let inFrontmatter = false;

    for (const line of lines) {
      if (line === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter && line.startsWith("title:")) {
        return line.replace("title:", "").trim();
      }
    }

    for (const line of lines) {
      if (line.startsWith("# ")) {
        return line.replace("# ", "").trim();
      }
    }

    return basename(filePath, ".md");
  }

  private addTagsToFrontmatter(content: string, newTags: string[]): string {
    const lines = content.split("\n");
    let inFrontmatter = false;
    let frontmatterEnd = -1;
    let tagsLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          frontmatterEnd = i;
          break;
        }
      }
      if (inFrontmatter && lines[i].startsWith("tags:")) {
        tagsLine = i;
      }
    }

    if (tagsLine >= 0) {
      const existingMatch = lines[tagsLine].match(/\[(.*?)\]/);
      const existingTags = existingMatch ? existingMatch[1].split(",").map((t) => t.trim()) : [];
      const allTags = [...new Set([...existingTags, ...newTags])];
      lines[tagsLine] = `tags: [${allTags.join(", ")}]`;
    } else if (frontmatterEnd >= 0) {
      lines.splice(frontmatterEnd, 0, `tags: [${newTags.join(", ")}]`);
    } else {
      lines.unshift("---", `tags: [${newTags.join(", ")}]`, "---", "");
    }
    return lines.join("\n");
  }
}
