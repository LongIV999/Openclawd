---
name: obsidian
description: |
  Work with Obsidian vaults (plain Markdown notes) and automate via obsidian-cli.
  Enhanced with Visual PKM features: auto-linking, smart tagging, graph optimization,
  Vietnamese support, and Telegram integration.
homepage: https://help.obsidian.md
metadata:
  {
    "openclaw":
      {
        "emoji": "💎",
        "requires": { "bins": ["obsidian-cli"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "yakitrak/yakitrak/obsidian-cli",
              "bins": ["obsidian-cli"],
              "label": "Install obsidian-cli (brew)",
            },
          ],
      },
  }
---

# Obsidian

Obsidian vault = a normal folder on disk.

Vault structure (typical)

- Notes: `*.md` (plain text Markdown; edit with any editor)
- Config: `.obsidian/` (workspace + plugin settings; usually don't touch from scripts)
- Canvases: `*.canvas` (JSON)
- Attachments: whatever folder you chose in Obsidian settings (images/PDFs/etc.)

## Find the active vault(s)

Obsidian desktop tracks vaults here (source of truth):

- `~/Library/Application Support/obsidian/obsidian.json`

`obsidian-cli` resolves vaults from that file; vault name is typically the **folder name** (path suffix).

Fast "what vault is active / where are the notes?"

- If you've already set a default: `obsidian-cli print-default --path-only`
- Otherwise, read `~/Library/Application Support/obsidian/obsidian.json` and use the vault entry with `"open": true`.

Notes

- Multiple vaults common (iCloud vs `~/Documents`, work/personal, etc.). Don't guess; read config.
- Avoid writing hardcoded vault paths into scripts; prefer reading the config or using `print-default`.

## obsidian-cli quick start

Pick a default vault (once):

- `obsidian-cli set-default "<vault-folder-name>"`
- `obsidian-cli print-default` / `obsidian-cli print-default --path-only`

Search

- `obsidian-cli search "query"` (note names)
- `obsidian-cli search-content "query"` (inside notes; shows snippets + lines)

Create

- `obsidian-cli create "Folder/New note" --content "..." --open`
- Requires Obsidian URI handler (`obsidian://…`) working (Obsidian installed).
- Avoid creating notes under "hidden" dot-folders (e.g. `.something/...`) via URI; Obsidian may refuse.

Move/rename (safe refactor)

- `obsidian-cli move "old/path/note" "new/path/note"`
- Updates `[[wikilinks]]` and common Markdown links across the vault (this is the main win vs `mv`).

Delete

- `obsidian-cli delete "path/note"`

Prefer direct edits when appropriate: open the `.md` file and change it; Obsidian will pick it up.

## Visual PKM Features

### Auto-Linking
Automatically detect and create bidirectional links between related notes.

```bash
pnpm tsx skills/obsidian/scripts/pkm-automation.ts auto-link
```

### Smart Tagging
AI-powered tag suggestions based on content analysis.

```bash
pnpm tsx skills/obsidian/scripts/pkm-automation.ts auto-tag --note "Path/To/Note.md"
```

### Graph Optimization
Optimize vault structure for better graph visualization.

```bash
pnpm tsx skills/obsidian/scripts/pkm-automation.ts optimize-graph
```

### Daily Notes
Create daily notes with Vietnamese date format and templates.

```bash
pnpm tsx skills/obsidian/scripts/pkm-automation.ts daily-note
```

### Templates
Pre-defined templates for different note types:

- **Project**: `skills/obsidian/templates/project.md`
- **Meeting**: `skills/obsidian/templates/meeting.md`
- **Reference**: `skills/obsidian/templates/reference.md`
- **Learning**: `skills/obsidian/templates/learning.md`
- **Journal**: `skills/obsidian/templates/journal.md`

### Vietnamese Support
- Tone-insensitive search (e.g., "tieng viet" matches "tiếng việt")
- Vietnamese date/time formatting
- Cultural context preservation
- Proper stopword filtering

```bash
# Fuzzy search (tone-insensitive)
pnpm tsx skills/obsidian/scripts/pkm-automation.ts fuzzy-search "tieng viet"
```

### Telegram Integration
Quick capture from Telegram to Obsidian:

- `/note <content>` - Quick note to Inbox
- `/task <content>` - Create task
- `/idea <content>` - Capture idea
- `/journal <content>` - Journal entry

## Automation Scripts

All automation scripts are in `skills/obsidian/scripts/pkm-automation.ts`.

Run with:
```bash
pnpm tsx skills/obsidian/scripts/pkm-automation.ts <command> [options]
```

Available commands:
- `daily-note` - Create daily note
- `auto-link` - Find and create backlinks
- `auto-tag` - AI-powered tagging
- `organize` - Auto-organize notes into folders
- `optimize-graph` - Graph optimization
- `create-meeting` - Create meeting note
- `create-reference` - Create reference note
- `create-learning` - Create learning note
- `sync-brain` - Sync with Antigravity brain folder
- `search-by-tags` - Search by tags
- `fuzzy-search` - Tone-insensitive Vietnamese search
- `weekly-review` - Generate weekly review
- `cleanup-orphans` - Archive orphan notes
- `rebuild-graph` - Rebuild graph connections
- `repair-links` - Scan and repair broken links

## Workflow Integration

See `.agent/workflows/obsidian-pkm.md` for detailed PKM automation workflows:

- Daily routines
- Note organization
- Template usage
- Search strategies
- Maintenance tasks
- Best practices

## Configuration

Add to `settings.json`:

```json
{
  "obsidian": {
    "defaultVault": "LongBest",
    "autoLinkEnabled": true,
    "autoTagEnabled": true,
    "dailyNoteTemplate": "templates/daily.md",
    "inboxFolder": "Inbox",
    "archiveFolder": "Archive",
    "vietnameseSupport": true
  }
}
```
