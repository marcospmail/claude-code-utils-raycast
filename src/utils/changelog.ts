import { simulateNetworkDelay } from "./network-simulation";

export interface ChangelogVersion {
  version: string;
  changes: string[];
}

const CHANGELOG_URL = "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md";

function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  const lines = markdown.split("\n");

  let currentVersion: string | null = null;
  let currentChanges: string[] = [];

  for (const line of lines) {
    // Match version headers like "## [1.2.3]" or "## 1.2.3"
    const versionMatch = line.match(/^##\s+\[?([^\]]+)\]?/);

    if (versionMatch) {
      // Save previous version if exists
      if (currentVersion) {
        versions.push({
          version: currentVersion,
          changes: currentChanges,
        });
      }

      // Start new version
      currentVersion = versionMatch[1];
      currentChanges = [];
    } else if (currentVersion) {
      const trimmed = line.trim();
      // Match list items: "- text" or "* text" (with optional leading whitespace for nesting)
      const listMatch = trimmed.match(/^[-*]\s+(.*)/);
      if (listMatch && listMatch[1]) {
        // Preserve indentation for nested items
        const indent = line.search(/\S/);
        const prefix = indent > 0 ? "  ".repeat(Math.floor(indent / 2)) : "";
        currentChanges.push(`${prefix}${listMatch[1]}`);
      }
    }
  }

  // Don't forget the last version
  if (currentVersion) {
    versions.push({
      version: currentVersion,
      changes: currentChanges,
    });
  }

  return versions;
}

export async function fetchChangelog(): Promise<ChangelogVersion[]> {
  return simulateNetworkDelay(async () => {
    const response = await fetch(CHANGELOG_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch changelog: ${response.status}`);
    }

    const data = await response.text();
    return parseChangelog(data);
  });
}

export function formatChangelogVersionChanges(version: ChangelogVersion): string {
  return version.changes.map((change) => `- ${change}`).join("\n");
}

export function formatChangeCount(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"}`;
}
