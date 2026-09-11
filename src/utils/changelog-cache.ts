import { Cache } from "@raycast/api";
import { ChangelogVersion } from "./changelog";

const cache = new Cache();
const VERSIONS_KEY = "changelog-versions";
const SEEN_VERSION_KEY = "changelog-seen-version";

export interface CachedChangelog {
  versions: ChangelogVersion[];
  fetchedAt: Date;
}

// Lets the menu bar paint the last known versions instantly instead of waiting on the
// network every time Raycast mounts the command.
export function getCachedChangelog(): CachedChangelog | null {
  const raw = cache.get(VERSIONS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return { versions: parsed.versions, fetchedAt: new Date(parsed.fetchedAt) };
  } catch {
    return null;
  }
}

export function setCachedChangelog(versions: ChangelogVersion[], fetchedAt: Date) {
  cache.set(VERSIONS_KEY, JSON.stringify({ versions, fetchedAt }));
}

// The newest version the user has already been shown. `null` means no marker has ever
// been recorded (fresh install) — a distinct state from "you are behind by a release".
export function getSeenVersion(): string | null {
  return cache.get(SEEN_VERSION_KEY) ?? null;
}

export function setSeenVersion(version: string) {
  cache.set(SEEN_VERSION_KEY, version);
}
