import { Clipboard, Icon, LaunchType, MenuBarExtra, environment, launchCommand, open, showHUD } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { ChangelogVersion, fetchChangelog, formatChangeCount } from "../../utils/changelog";
import { getCachedChangelog, getSeenVersion, setCachedChangelog, setSeenVersion } from "../../utils/changelog-cache";
// Reused as-is from the usage menu bar command, which already formats "Updated ..." this way.
import { formatRelativeTime } from "../../utils/usage-cache";

const CHANGELOG_GITHUB_URL = "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md";
// A menu bar dropdown stops being usable long before the whole changelog fits, and the
// newest handful of releases is what "what changed recently" actually means.
const MAX_VERSIONS_SHOWN = 10;

function copyValue(value: string) {
  return async () => {
    await Clipboard.copy(value);
    await showHUD("Copied to clipboard");
  };
}

async function openChangelogCommand() {
  await launchCommand({ name: "changelog", type: LaunchType.UserInitiated });
}

// Opens the full Changelog command already pushed into the detail view for this version.
async function openVersionInRaycast(version: string) {
  await launchCommand({ name: "changelog", type: LaunchType.UserInitiated, context: { version } });
}

export default function ChangelogMonitor() {
  const cached = getCachedChangelog();
  const [versions, setVersions] = useState<ChangelogVersion[]>(cached?.versions ?? []);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(cached?.fetchedAt ?? null);
  const [seenVersion, setSeenVersionState] = useState<string | null>(getSeenVersion());
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Read from async callbacks, where the `versions` state would be a stale closure.
  const versionsRef = useRef<ChangelogVersion[]>(cached?.versions ?? []);
  // React invokes the mount effect twice in development; without this the command fires two
  // fetches of the full changelog per mount.
  const refreshingRef = useRef(false);

  // Raycast mounts the command on its background interval and again every time the menu
  // is opened, so mounting is both the refresh and the "user saw it" signal.
  useEffect(() => {
    function reconcileSeenVersion(latest: string | undefined) {
      if (!latest) return;
      // A fresh install has no marker yet, so seed it rather than flagging a changelog the
      // user has never been shown. Opening the menu is the click that acknowledges a release.
      if (getSeenVersion() === null || environment.launchType === LaunchType.UserInitiated) {
        setSeenVersion(latest);
        setSeenVersionState(latest);
      }
    }

    async function refresh() {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setIsLoading(true);
      try {
        const data = await fetchChangelog();
        const now = new Date();
        versionsRef.current = data;
        setVersions(data);
        setFetchedAt(now);
        setCachedChangelog(data, now);
        setError(null);
        setRefreshFailed(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch changelog";
        // Keep the cached versions on screen when we have them; only replace the whole menu
        // with an error when there is nothing at all to show.
        if (versionsRef.current.length > 0) {
          setRefreshFailed(true);
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
        refreshingRef.current = false;
        reconcileSeenVersion(versionsRef.current[0]?.version);
      }
    }

    refresh();
  }, []);

  if (error && versions.length === 0) {
    return (
      // No menu bar title here on purpose: an API error string is far too long to sit in the
      // menu bar, so it goes inside the dropdown instead.
      <MenuBarExtra icon={Icon.Document} isLoading={isLoading} tooltip="Claude Code Changelog">
        <MenuBarExtra.Item title="Failed to Load Changelog" icon={Icon.ExclamationMark} />
        <MenuBarExtra.Item title={error} onAction={copyValue(error)} />
        <MenuBarExtra.Separator />
        <MenuBarExtra.Item title="View on GitHub" icon={Icon.Globe} onAction={() => open(CHANGELOG_GITHUB_URL)} />
      </MenuBarExtra>
    );
  }

  const latestVersion = versions[0]?.version ?? null;
  const hasNewVersion = latestVersion !== null && seenVersion !== null && latestVersion !== seenVersion;
  // The badge replaces the version number until the user opens the menu.
  const title = hasNewVersion ? "NEW VERSION!" : latestVersion ? `v${latestVersion}` : "";

  return (
    <MenuBarExtra icon={Icon.Document} title={title} isLoading={isLoading} tooltip="Claude Code Changelog">
      <MenuBarExtra.Item title="Open Changelog" icon={Icon.List} onAction={openChangelogCommand} />
      <MenuBarExtra.Item title="View on GitHub" icon={Icon.Globe} onAction={() => open(CHANGELOG_GITHUB_URL)} />

      <MenuBarExtra.Section title="Recent Versions">
        {versions.slice(0, MAX_VERSIONS_SHOWN).map((version) => (
          <MenuBarExtra.Item
            key={version.version}
            title={version.version}
            subtitle={formatChangeCount(version.changes.length)}
            icon={Icon.Document}
            onAction={() => openVersionInRaycast(version.version)}
          />
        ))}
      </MenuBarExtra.Section>

      {fetchedAt && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title={`Updated ${formatRelativeTime(fetchedAt)}${refreshFailed ? " (refresh failed)" : ""}`}
          />
        </MenuBarExtra.Section>
      )}
    </MenuBarExtra>
  );
}
