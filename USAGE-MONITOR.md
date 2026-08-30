# Claude Usage Monitor - Menu Bar Command

A Raycast menu bar command that displays Claude API usage limits in real-time.

## How It Works

The command reads your Claude Code OAuth token from the macOS Keychain, calls the Anthropic usage API, and displays your current 5-hour and 7-day usage percentages directly in the menu bar. It auto-refreshes every 5 minutes in the background.

### Menu Bar Display

```
🟢 5h:7% 7d:68%
```

Color-coded emoji indicates the highest usage level:
- 🟢 Under 50%
- 🟡 50-70%
- 🟠 70-90%
- 🔴 Over 90%

### Dropdown Panel

- **5-Hour Window** - percentage, progress bar, reset countdown
- **7-Day Window** - percentage, progress bar, reset countdown
- **Sonnet (7-Day)** - shown only if data exists
- **Extra Usage** - shown only if enabled, displays used/limit credits
- **Last updated** timestamp
- **Open Anthropic Console** action (Cmd+O)

## Architecture

### Files Created

| File | Purpose |
|------|---------|
| `src/usage-monitor.tsx` | MenuBarExtra component (entry point) |
| `src/utils/usage-api.ts` | API client, types, formatting helpers |

### Files Modified

| File | Change |
|------|--------|
| `src/utils/claude-cli.ts` | Exported `getOAuthToken()` (was private) |
| `package.json` | Added `usage-monitor` command with `menu-bar` mode and `5m` interval |

### Data Flow

```
macOS Keychain
    │
    ▼
getOAuthToken() ─── reads Claude Code OAuth credentials
    │
    ▼
fetchUsageData() ─── GET https://api.anthropic.com/api/oauth/usage
    │                  Headers: Bearer token, anthropic-beta: oauth-2025-04-20
    │
    ▼
UsageData ─── parsed response with typed interfaces
    │
    ▼
Raycast Cache ─── persists data across launches for instant display
    │
    ▼
MenuBarExtra ─── renders title + dropdown sections
```

### API Details

- **Endpoint**: `GET https://api.anthropic.com/api/oauth/usage`
- **Auth**: `Authorization: Bearer {oauthToken}`
- **Required Header**: `anthropic-beta: oauth-2025-04-20`
- **Response fields**: `five_hour.utilization`, `seven_day.utilization`, `resets_at` (ISO 8601), `extra_usage`

This is an undocumented API that could change at any time.

### Caching

Uses Raycast's `Cache` API to store the last fetched data. On launch, cached data is shown immediately while a fresh fetch runs in the background. This prevents the menu bar from showing empty state between refreshes.

### Auto-Refresh

The `"interval"` in package.json tells Raycast to launch the command in the background on a schedule. Each background launch triggers a fresh API call and updates the cached data. Opening the menu bar item also mounts the command, so every open fetches fresh data too.

The API call has a 10 second timeout — without it a stalled network would leave the menu bar stuck on "Refreshing..." forever.

## Usage

1. Ensure you're logged into Claude Code (`claude` in terminal)
2. The "Claude Usage" command appears in Raycast and as a menu bar icon
3. Click the menu bar icon to see detailed usage breakdown — opening the menu refreshes the data automatically
4. Use Cmd+O to open Anthropic Console

## Error States

- **Not logged in**: Shows "Not logged in" with instruction to run `claude` in terminal
- **API error**: Shows the error message in the menu bar; the next open retries
- **No data yet**: Shows cached data or placeholder while loading
