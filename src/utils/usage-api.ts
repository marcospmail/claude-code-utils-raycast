import { getOAuthToken } from "./claude-cli";

const USAGE_API_URL = "https://api.anthropic.com/api/oauth/usage";
// Without this the request can hang forever on a stalled network (asleep/woken laptop,
// captive wifi, VPN), leaving the menu bar stuck on "Refreshing...".
const USAGE_API_TIMEOUT_MS = 10_000;

export interface UsageWindow {
  utilization: number;
  resetsAt: Date | null;
}

export interface ExtraUsage {
  isEnabled: boolean;
  monthlyLimit: number | null;
  usedCredits: number | null;
}

export interface UsageData {
  fiveHour: UsageWindow;
  sevenDay: UsageWindow;
  sonnet: UsageWindow | null;
  extraUsage: ExtraUsage;
  fetchedAt: Date;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function fetchUsageData(): Promise<UsageData> {
  const token = await getOAuthToken();
  if (!token) {
    throw new Error("Not logged in. Run `claude` in your terminal to authenticate.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_API_TIMEOUT_MS);

  let json: Record<string, Record<string, unknown>>;
  try {
    const response = await fetch(USAGE_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "claude-code/cli",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    json = (await response.json()) as Record<string, Record<string, unknown>>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const fiveHour = json.five_hour;
  const sevenDay = json.seven_day;
  const sonnetRaw = json.seven_day_sonnet ?? json.sonnet_only;
  const extraRaw = json.extra_usage;

  if (!fiveHour || typeof fiveHour.utilization !== "number") {
    throw new Error("Invalid API response: missing five_hour data");
  }
  if (!sevenDay || typeof sevenDay.utilization !== "number") {
    throw new Error("Invalid API response: missing seven_day data");
  }

  return {
    fiveHour: {
      utilization: fiveHour.utilization as number,
      resetsAt: parseDate(fiveHour.resets_at as string),
    },
    sevenDay: {
      utilization: sevenDay.utilization as number,
      resetsAt: parseDate(sevenDay.resets_at as string),
    },
    sonnet: sonnetRaw
      ? {
          utilization: sonnetRaw.utilization as number,
          resetsAt: parseDate(sonnetRaw.resets_at as string),
        }
      : null,
    extraUsage: {
      isEnabled: Boolean(extraRaw?.is_enabled),
      monthlyLimit: typeof extraRaw?.monthly_limit === "number" ? extraRaw.monthly_limit / 100 : null,
      usedCredits: typeof extraRaw?.used_credits === "number" ? extraRaw.used_credits / 100 : null,
    },
    fetchedAt: new Date(),
  };
}

export function formatResetTime(resetsAt: Date | null): string {
  if (!resetsAt) return "Unknown";
  const now = new Date();
  const diffMs = resetsAt.getTime() - now.getTime();
  if (diffMs <= 0) return "Now";

  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;

  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

export function utilizationPercent(utilization: number): number {
  return Math.max(0, Math.round(utilization));
}
