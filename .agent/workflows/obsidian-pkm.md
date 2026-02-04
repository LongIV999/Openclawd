---
description: Visual PKM and Obsidian automation workflow for LongBest AI
---

# Visual PKM & Obsidian Automation

Workflow tự động hóa Personal Knowledge Management với Obsidian integration.

## Prerequisites

```bash
# Verify obsidian-cli installation
which obsidian-cli

# Set default vault (run once)
obsidian-cli set-default "YourVaultName"

# Verify vault path
obsidian-cli print-default --path-only
```

## Daily Note Creation

Tự động tạo daily note với template và metadata.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts daily-note
```

Creates:
- Daily note với Vietnamese date format
- Frontmatter: tags, date, mood tracker
- Template sections: tasks, meetings, notes, journal
- Auto-linking to yesterday's note

## Auto-Linking Between Notes

Tìm và tạo backlinks tự động giữa các notes.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts auto-link --vault "$(obsidian-cli print-default --path-only)"
```

Features:
- Scan all notes for related keywords
- Suggest wikilinks `[[Note Title]]`
- Create bidirectional links
- Update graph connections

## Smart Tag Management

Tự động tag notes dựa trên content analysis.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts auto-tag --note "Path/To/Note.md"
```

AI-powered tagging:
- Analyze note content
- Extract key topics
- Suggest relevant tags
- Update frontmatter

## Note Organization

Tự động organize notes vào folders dựa trên category.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts organize --dry-run
```

Organization rules:
- Projects → `Projects/`
- Reference → `Reference/`
- Journal → `Journal/YYYY/MM/`
- Ideas → `Ideas/`
- Tasks → `Tasks/`

Remove `--dry-run` to apply changes.

## Graph View Optimization

Optimize vault structure cho better graph visualization.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts optimize-graph
```

Optimization strategies:
- Identify orphan notes (no links)
- Suggest hub notes for clusters
- Detect over-connected nodes
- Recommend link pruning

## Quick Capture from Telegram

Capture ideas trực tiếp từ Telegram vào Obsidian.

```bash
# Example: send "/note Work on PKM automation" in Telegram
# Automatically creates note in Inbox/ folder
```

Quick commands:
- `/note <content>` - Quick note
- `/task <content>` - Create task
- `/idea <content>` - Capture idea
- `/journal <content>` - Journal entry

## Template Management

Create và apply templates cho different note types.

### Available Templates

1. **Project Template**
   ```bash
   obsidian-cli create "Projects/New Project" --content "$(cat skills/obsidian/templates/project.md)"
   ```

2. **Meeting Notes**
   ```bash
   pnpm tsx skills/obsidian/scripts/pkm-automation.ts create-meeting --title "Team Sync"
   ```

3. **Reference Note**
   ```bash
   pnpm tsx skills/obsidian/scripts/pkm-automation.ts create-reference --url "<url>"
   ```

4. **Learning Note**
   ```bash
   pnpm tsx skills/obsidian/scripts/pkm-automation.ts create-learning --topic "TypeScript"
   ```

## Sync with Brain Folder

Đồng bộ giữa Obsidian vault và Antigravity brain folder.

```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts sync-brain \
  --vault "$(obsidian-cli print-default --path-only)" \
  --brain "$HOME/.gemini/antigravity/brain"
```

Sync features:
- Two-way sync
- Conflict resolution
- Markdown formatting preservation
- Frontmatter compatibility

## Search & Retrieve

Advanced search với Vietnamese support.

```bash
# Search by content (Vietnamese-aware)
obsidian-cli search-content "tiếng việt"

# Search by tags
pnpm tsx skills/obsidian/scripts/pkm-automation.ts search-by-tags --tags "AI,automation"

# Fuzzy search (tone-insensitive)
pnpm tsx skills/obsidian/scripts/pkm-automation.ts fuzzy-search "tieng viet"
```

## Maintenance Tasks

### Weekly Review
```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts weekly-review
```

Generates review note:
- Notes created this week
- Most linked notes
- Orphan notes
- Tag statistics
- Graph insights

### Cleanup Orphans
```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts cleanup-orphans --archive
```

### Rebuild Graph
```bash
# turbo
pnpm tsx skills/obsidian/scripts/pkm-automation.ts rebuild-graph
```

## Integration với Custom Commands

PKM automation integrates với LongBest AI workflows:

- `/brainstorm` → Saves ideas to Obsidian
- `/feature` → Creates project note
- `/bugfix` → Links to relevant notes
- `/deploy` → Creates deployment log

## Configuration

Edit `settings.json` để customize PKM behavior:

```json
{
  "obsidian": {
    "defaultVault": "LongBest",
    "autoLinkEnabled": true,
    "autoTagEnabled": true,
    "dailyNoteTemplate": "templates/daily.md",
    "inboxFolder": "Inbox",
    "archiveFolder": "Archive"
  }
}
```

## Best Practices

1. **Daily Routine**
   - Run `daily-note` mỗi sáng
   - Capture ideas qua Telegram
   - Review orphans hàng tuần

2. **Linking Strategy**
   - Link early, link often
   - Use `[[wikilinks]]` cho notes
   - Use `#tags` cho categorization

3. **Organization**
   - Keep Inbox/ clean
   - Archive old notes
   - Maintain folder structure

4. **Search Optimization**
   - Use descriptive titles
   - Add frontmatter tags
   - Include Vietnamese keywords

## Troubleshooting

### Vault Not Found
```bash
# Check obsidian.json
cat ~/Library/Application\ Support/obsidian/obsidian.json | jq '.vaults'

# Set default again
obsidian-cli set-default "VaultName"
```

### Permission Issues
```bash
# Fix vault permissions
chmod -R u+rw "$(obsidian-cli print-default --path-only)"
```

### Broken Links
```bash
# Scan and repair
pnpm tsx skills/obsidian/scripts/pkm-automation.ts repair-links --fix
```
