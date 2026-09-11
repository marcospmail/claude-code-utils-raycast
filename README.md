# Claude Code Utils

A powerful Raycast extension for browsing, searching, and managing your Claude Code environment. Access your message history, create reusable snippets, browse agents/commands/skills, monitor usage, check service status, and more.

## Features

### 📨 **Received Messages**

Browse all messages received from Claude Code. Supports normal keyword search and AI-powered semantic search (Raycast Pro required).

### ✉️ **Sent Messages**

Review and search through messages you sent to Claude Code. Supports normal keyword search and AI-powered semantic search (Raycast Pro required).

### ✂️ **Create Snippet**

Save frequently used code or text as reusable snippets for quick access.

### 📋 **Browse Snippets**

View, search, and manage all your saved code snippets.

### 📚 **Commands Cheat Sheet**

Quick reference for all Claude Code commands, keyboard shortcuts, CLI flags, and special keywords like `@file` and `@docs`.

### 🤖 **Browse Agents**

View and manage your Claude Code agents from `~/.claude/agents`.

### ⚡ **Browse Commands**

View and manage your Claude Code commands from `~/.claude/commands`.

### 📝 **Changelog**

View the latest Claude Code changelog with updates, releases, and new features directly from the official repository.

### 🔔 **Changelog Monitor** (Menu Bar)

Keeps the latest Claude Code version in your menu bar. Shows `vX.Y.Z` normally and swaps it for **NEW VERSION!** as soon as a newer release lands, until you open the menu. The dropdown lists the 10 most recent versions with their change counts; clicking one opens that version's changes in Raycast.

### 🔍 **Search Sessions**

Deep search through all Claude Code session content. Find any conversation across all your projects.

### 🔄 **Transform Selection**

Transform text using Claude AI. Seeded on first run with 11 built-in transforms (Explain Code, Find Bugs, Convert Language, Add Types, Optimize, Add Comments, Simplify, Write Tests, Generate Types, Markdown Table, Explain Regex), then fully user-manageable like snippets — create, edit, and delete transforms directly in Raycast. Prompts use `{{selection}}` (your selected text) and `{{clipboard}}` (clipboard contents) placeholders, read fresh each time you run a transform. Each transform has a configurable model (haiku/sonnet/opus), an optional effort level (model-dependent), an output mode (show the result or replace your selection in place), and an independent "Copy to clipboard" option. Runs via the local claude CLI.

### 💬 **Chat**

Send a quick chat message to Claude and get a response directly from Raycast.

### 🧩 **Browse Skills**

View and manage your Claude Code skills from `~/.claude/skills/`.

### 🚦 **Claude Status**

View Claude service status, active incidents, and incident history.

### 📊 **Claude Usage Monitor** (Menu Bar)

Monitor your Claude API usage limits in real-time. Displays 5-hour and 7-day usage percentages in the menu bar, refreshed on a background interval and every time you open the menu. Click to see detailed breakdown with reset countdowns and copy-to-clipboard actions.

### 📊 **Claude Usage** (View)

View Claude usage stats with progress bars, reset times, and refresh. Full-screen view of your usage data.

## Installation

### From Raycast Store

1. Open Raycast
2. Search for "Claude Code Utils"
3. Click Install

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/marcospmail/claude-code-utils.git

# Navigate to the extension directory
cd claude-code-utils

# Install dependencies
npm install

# Build and install in Raycast
npm run build && npm run publish
```

## Usage

### Quick Start

1. Open Raycast (`⌘ + Space`)
2. Type "Claude" to see all available commands
3. Select the feature you want to use:
   - **Create Snippet** - Save code/text as reusable snippets
   - **Browse Snippets** - Manage your snippets
   - **Received Messages** - View received messages
   - **Sent Messages** - View sent messages
   - **Commands Cheat Sheet** - Reference guide
   - **Browse Agents** - View Claude Code agents
   - **Browse Commands** - View Claude Code commands
   - **Browse Skills** - View Claude Code skills
   - **Changelog** - View Claude Code updates and releases
   - **Changelog Monitor** - Watch for new Claude Code versions from the menu bar
   - **Search Sessions** - Deep search through Claude Code conversations
   - **Transform Selection** - Transform selected text with Claude AI
   - **Chat** - Quick chat with Claude
   - **Claude Status** - Check Claude service status
   - **Claude Usage** - View usage stats and monitor in menu bar

## Technical Details

### Data Source

- Reads from `~/.claude/projects/` where Claude Code stores conversations
- Automatically finds the most recent conversations
- No data is sent to external servers

### Limitations

- Scans up to 50 most recent conversation files across projects

## Privacy & Security

- **Local Processing** - All data processing happens locally on your machine
- **No External Storage** - Your messages are never uploaded or stored externally
- **Open Source** - Full source code available for review

## Screenshots

<table>
  <tr>
    <td><img src="metadata/claude-code-utils-1.png" alt="Browse Agents" width="400"/></td>
    <td><img src="metadata/claude-code-utils-2.png" alt="Browse Commands" width="400"/></td>
  </tr>
  <tr>
    <td><img src="metadata/claude-code-utils-3.png" alt="Browse Snippets" width="400"/></td>
    <td><img src="metadata/claude-code-utils-4.png" alt="Received Messages" width="400"/></td>
  </tr>
  <tr>
    <td><img src="metadata/claude-code-utils-5.png" alt="Sent Messages" width="400"/></td>
    <td><img src="metadata/claude-code-utils-6.png" alt="Commands Cheat Sheet" width="400"/></td>
  </tr>
</table>

## License

MIT License - see LICENSE file for details
