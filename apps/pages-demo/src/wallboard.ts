export const WALL_VIEWS = [
  { id: "infra", label: "Infra overview" },
  { id: "applications", label: "Applications and services" },
  { id: "alerts", label: "Critical incidents" },
  { id: "disks", label: "Disk and risk" },
] as const;

export type WallViewId = (typeof WALL_VIEWS)[number]["id"];

export function stepIndex(current: number, direction: 1 | -1, length = WALL_VIEWS.length): number {
  return (current + direction + length) % length;
}

export function nextViewLabel(current: number): string {
  return WALL_VIEWS[stepIndex(current, 1)].label;
}

export type AnnounceItem = { id: string; hostname: string; summary: string };

export function unseenAlerts(seen: ReadonlySet<string>, alerts: AnnounceItem[]): AnnounceItem[] {
  return alerts.filter((alert) => alert.id && !seen.has(alert.id));
}

export function demoAnnouncement(alert: AnnounceItem): string {
  return `Demo. Critical alert. ${alert.hostname}. ${alert.summary}. Simulated data. No restart was performed.`;
}

export function demoEnabledLine(): string {
  return "Demo. Announcements are on. This is simulated data. No restart was performed.";
}

export function demoTestLine(): string {
  return "Demo. This is a test of the announcement. Simulated data. No restart was performed.";
}

export const PRESENTATION = [
  { id: "infra", until: 12, title: "Infra health" },
  { id: "network", until: 24, title: "Network" },
  { id: "app", until: 36, title: "Application outage" },
  { id: "net", until: 48, title: "Network loss" },
  { id: "disk", until: 58, title: "Disk risk" },
  { id: "recover", until: 72, title: "Recovery" },
] as const;

export type StageId = (typeof PRESENTATION)[number]["id"];
export type TileStatus = "healthy" | "warning" | "critical" | "unknown";

export type RackTile = {
  name: string;
  app: string;
  status: TileStatus;
  tag: string;
  spark: number[];
};

const RACK_SPEC: Array<[string, string]> = [
  ["api-017", "Payments"], ["api-004", "Ledger"], ["api-008", "Checkout"], ["api-012", "Identity"],
  ["api-021", "Notify"], ["api-033", "Payments"], ["api-042", "Ledger"], ["api-055", "Checkout"],
  ["db-042", "Payments"], ["db-018", "Ledger"], ["db-007", "Checkout"], ["db-011", "Identity"],
  ["worker-086", "Notify"], ["worker-014", "Payments"], ["worker-028", "Ledger"], ["worker-110", "Checkout"],
  ["cache-003", "Identity"], ["cache-009", "Notify"], ["gw-003", "Payments"], ["gw-012", "Ledger"],
  ["queue-004", "Checkout"], ["queue-015", "Identity"], ["api-061", "Notify"], ["api-070", "Payments"],
  ["db-025", "Ledger"], ["db-033", "Checkout"], ["worker-044", "Identity"], ["worker-052", "Notify"],
  ["api-088", "Payments"], ["api-096", "Ledger"], ["db-051", "Checkout"], ["worker-073", "Identity"],
  ["cache-016", "Notify"], ["gw-021", "Payments"], ["queue-022", "Ledger"], ["api-104", "Checkout"],
  ["db-060", "Identity"], ["worker-099", "Notify"], ["api-120", "Payments"], ["worker-130", "Ledger"],
];

function baseline(index: number): TileStatus {
  if (index % 17 === 0) return "warning";
  if (index % 19 === 0) return "unknown";
  return "healthy";
}

export function stageAt(second: number): (typeof PRESENTATION)[number] {
  const t = ((second % 72) + 72) % 72;
  return PRESENTATION.find((stage) => t < stage.until) ?? PRESENTATION[PRESENTATION.length - 1];
}

export function tilesAt(second: number): RackTile[] {
  const stage = stageAt(second).id;
  return RACK_SPEC.map(([name, app], index) => {
    let status = baseline(index);
    let tag = status === "healthy" ? "OK" : status === "warning" ? "WARN" : "UNK";
    if (stage === "app" && name === "api-017") {
      status = "critical";
      tag = "APP";
    }
    if (stage === "net" && (name === "worker-086" || name === "gw-003")) {
      status = "unknown";
      tag = "NET";
    }
    if (stage === "disk" && name === "db-042") {
      status = "critical";
      tag = "RO";
    }
    if (stage === "disk" && name === "db-018") {
      status = "warning";
      tag = "DISK";
    }
    if (stage === "recover" && (name === "api-017" || name === "db-042" || name === "worker-086" || name === "gw-003" || name === "db-018")) {
      status = "healthy";
      tag = "BACK";
    }
    const level = status === "critical" ? 78 : status === "warning" ? 62 : status === "unknown" ? 20 : 34;
    const spark = Array.from({ length: 18 }, (_, point) => level + Math.sin((second + index + point) / 3) * 6);
    return { name, app, status, tag, spark };
  });
}

export function linksAt(second: number): Array<{ id: string; from: string; to: string; latencyMs: number; down: boolean }> {
  const stage = stageAt(second).id;
  const loss = stage === "net";
  return [
    { id: "dc12", from: "DC-01", to: "DC-02", latencyMs: loss ? 480 : 12, down: loss },
    { id: "dc23", from: "DC-02", to: "DC-03", latencyMs: loss ? 0 : 18, down: loss },
    { id: "dc13", from: "DC-01", to: "DC-03", latencyMs: 9, down: false },
  ];
}

export function eventsAt(second: number): Array<{ id: string; text: string }> {
  const order = ["infra", "network", "app", "net", "disk", "recover"];
  const stage = stageAt(second).id;
  const all = [
    { id: "boot", stage: "infra", text: "Demo clock started. Rack is 40 of 500 simulated hosts." },
    { id: "netview", stage: "network", text: "Simulated paths between DC-01, DC-02, and DC-03." },
    { id: "app", stage: "app", text: "api-017 application probe failed (HTTP 503). Heartbeat story stays fresh. No restart." },
    { id: "net", stage: "net", text: "worker-086 path lost and latency spiked. Marked unknown, not proven down." },
    { id: "disk", stage: "disk", text: "db-042 mount read-only. db-018 disk high. No restart." },
    { id: "ok", stage: "recover", text: "Demo recovery. api-017, worker-086, and db-042 are healthy again in the sample." },
  ];
  const idx = order.indexOf(stage);
  return all.filter((event) => order.indexOf(event.stage) <= idx).map(({ id, text }) => ({ id, text }));
}

export function alertAt(second: number): AnnounceItem | null {
  const stage = stageAt(second).id;
  if (stage === "app") return { id: "demo-app-api-017", hostname: "api-017", summary: "Application outage. HTTP 503." };
  if (stage === "net") return { id: "demo-net-worker-086", hostname: "worker-086", summary: "Network loss and latency. Unknown, not down." };
  if (stage === "disk") return { id: "demo-disk-db-042", hostname: "db-042", summary: "Disk read-only. No restart performed." };
  return null;
}

export function countsOf(tiles: RackTile[]) {
  return {
    total: 500,
    shown: tiles.length,
    healthy: tiles.filter((tile) => tile.status === "healthy").length,
    warning: tiles.filter((tile) => tile.status === "warning").length,
    critical: tiles.filter((tile) => tile.status === "critical").length,
    unknown: tiles.filter((tile) => tile.status === "unknown").length,
  };
}
