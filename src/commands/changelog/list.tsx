import { Action, ActionPanel, Icon, LaunchProps, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { ChangelogVersion, fetchChangelog, formatChangeCount } from "../../utils/changelog";
import ChangelogDetail from "./detail";

interface ChangelogLaunchContext {
  // Set by the Changelog Monitor menu bar command to jump straight to one version.
  version?: string;
}

export default function Changelog({ launchContext }: LaunchProps<{ launchContext?: ChangelogLaunchContext }>) {
  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<ChangelogVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { push } = useNavigation();
  // The versions arrive asynchronously, so the requested one can only be pushed once they
  // load — this keeps that from firing again on every later render.
  const hasPushedRequestedVersion = useRef(false);
  const requestedVersion = launchContext?.version;

  useEffect(() => {
    async function loadChangelog() {
      try {
        setIsLoading(true);
        const data = await fetchChangelog();
        setVersions(data);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch changelog";
        setError(errorMessage);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load changelog",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadChangelog();
  }, []);

  useEffect(() => {
    if (hasPushedRequestedVersion.current || !requestedVersion) return;
    const match = versions.find((version) => version.version === requestedVersion);
    // An unknown version just leaves the user on the list rather than failing.
    if (!match) return;
    hasPushedRequestedVersion.current = true;
    push(<ChangelogDetail version={match} />);
  }, [versions, requestedVersion, push]);

  if (error && !isLoading) {
    return (
      <List>
        <List.EmptyView icon={Icon.ExclamationMark} title="Failed to Load Changelog" description={error} />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search changelog versions...">
      {versions.map((version) => (
        <List.Item
          key={version.version}
          title={version.version}
          icon={Icon.Document}
          accessories={[{ text: formatChangeCount(version.changes.length) }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Changes" target={<ChangelogDetail version={version} />} icon={Icon.Eye} />
              <Action.CopyToClipboard
                title="Copy to Clipboard"
                content={version.changes.map((change) => `- ${change}`).join("\n")}
                icon={Icon.Clipboard}
                shortcut={{ modifiers: ["cmd"], key: "enter" }}
              />
              <Action.OpenInBrowser
                title="View on GitHub"
                url="https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md"
                icon={Icon.Globe}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
