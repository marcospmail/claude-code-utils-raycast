import { Clipboard, MenuBarExtra, showHUD, open } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { UsageData, fetchUsageData, formatResetTime, utilizationPercent } from "../../utils/usage-api";
import { getCachedData, setCachedData, buildProgressBar, formatRelativeTime } from "../../utils/usage-cache";

// Keep the "Refreshing..." title on screen long enough to be readable even when
// the API answers instantly.
const MIN_REFRESH_SPINNER_MS = 1000;

function copyValue(value: string) {
  return async () => {
    await Clipboard.copy(value);
    await showHUD("Copied to clipboard");
  };
}

export default function UsageMonitor() {
  const cached = getCachedData();
  const [data, setData] = useState<UsageData | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasDataRef = useRef(!!cached);
  const refreshingRef = useRef(false);

  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsLoading(true);
    const start = Date.now();
    try {
      const usage = await fetchUsageData();
      setData(usage);
      setCachedData(usage);
      setError(null);
      setRefreshFailed(false);
      hasDataRef.current = true;
      const elapsed = Date.now() - start;
      if (elapsed < MIN_REFRESH_SPINNER_MS) {
        await new Promise((r) => setTimeout(r, MIN_REFRESH_SPINNER_MS - elapsed));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch usage";
      // Keep the cached numbers on screen when we have them; only replace the whole
      // menu with an error when there is nothing at all to show.
      if (hasDataRef.current) {
        setRefreshFailed(true);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      refreshingRef.current = false;
    }
  }

  // Raycast mounts the command every time the menu bar item is opened, so opening
  // the menu is itself the refresh action — no manual Refresh item needed.
  useEffect(() => {
    refresh();
  }, []);

  if (error) {
    return (
      <MenuBarExtra title={error} isLoading={isLoading}>
        <MenuBarExtra.Item title="Claude Usage" onAction={() => open("https://claude.ai/settings/usage")} />
      </MenuBarExtra>
    );
  }

  const fivePercent = data ? utilizationPercent(data.fiveHour.utilization) : 0;
  const sevenPercent = data ? utilizationPercent(data.sevenDay.utilization) : 0;
  const sonnetPercent = data?.sonnet ? utilizationPercent(data.sonnet.utilization) : 0;
  const sonnetReset = data?.sonnet ? formatResetTime(data.sonnet.resetsAt) : "";

  const fiveReset = data ? formatResetTime(data.fiveHour.resetsAt) : "5h";
  const sevenReset = data ? formatResetTime(data.sevenDay.resetsAt) : "7d";
  const title = isLoading ? "Refreshing..." : `${fiveReset}:${fivePercent}% | ${sevenReset}:${sevenPercent}%`;

  return (
    <MenuBarExtra title={title} isLoading={isLoading}>
      <MenuBarExtra.Item title="Claude Usage" onAction={() => open("https://claude.ai/settings/usage")} />
      <MenuBarExtra.Separator />

      <MenuBarExtra.Section title="5-Hour Window">
        <MenuBarExtra.Item
          title={`${fivePercent}%  ${buildProgressBar(fivePercent, 15)}`}
          onAction={copyValue(`${fivePercent}%`)}
        />
        <MenuBarExtra.Item title={`Resets ${fiveReset}`} onAction={copyValue(`Resets ${fiveReset}`)} />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section title="7-Day Window">
        <MenuBarExtra.Item
          title={`${sevenPercent}%  ${buildProgressBar(sevenPercent, 15)}`}
          onAction={copyValue(`${sevenPercent}%`)}
        />
        <MenuBarExtra.Item title={`Resets ${sevenReset}`} onAction={copyValue(`Resets ${sevenReset}`)} />
      </MenuBarExtra.Section>

      {data?.sonnet && (
        <MenuBarExtra.Section title="Sonnet (7-Day)">
          <MenuBarExtra.Item
            title={`${sonnetPercent}%  ${buildProgressBar(sonnetPercent, 15)}`}
            onAction={copyValue(`${sonnetPercent}%`)}
          />
          <MenuBarExtra.Item title={`Resets ${sonnetReset}`} onAction={copyValue(`Resets ${sonnetReset}`)} />
        </MenuBarExtra.Section>
      )}

      {data?.extraUsage.isEnabled && data.extraUsage.usedCredits !== null && data.extraUsage.monthlyLimit !== null && (
        <MenuBarExtra.Section title="Extra Usage">
          <MenuBarExtra.Item
            title={`$${data.extraUsage.usedCredits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / $${data.extraUsage.monthlyLimit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            onAction={copyValue(
              `$${data.extraUsage.usedCredits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / $${data.extraUsage.monthlyLimit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            )}
          />
        </MenuBarExtra.Section>
      )}

      {data && (
        <MenuBarExtra.Item
          title={`Updated ${formatRelativeTime(data.fetchedAt)}${refreshFailed ? " (refresh failed)" : ""}`}
        />
      )}
    </MenuBarExtra>
  );
}
