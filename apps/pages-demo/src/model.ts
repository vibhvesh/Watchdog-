export type Scenario = "healthy" | "warning_disk" | "warning_cpu" | "critical_app" | "critical_disk" | "stale";
export type Status = "critical" | "warning" | "healthy" | "unknown";
export type RolePreview = "user" | "admin";
export type ScenarioAction = "app_failure" | "disk_warning" | "stale_collector" | "recover";

export type Host = {
  index: number;
  id: string;
  hostname: string;
  role: string;
  site: string;
  application: string;
  scenario: Scenario;
  pinned: boolean;
  cpu: number;
  mem: number;
  disk: number;
  inode: number;
  io: number;
  readOnly: boolean;
  appProbe: "pass" | "fail";
  appDetail: string;
  staleSeconds: number;
  restarts: number;
  reboots: number;
};

const PLAN = [
  { role: "api", count: 180, prefix: "api" },
  { role: "db", count: 80, prefix: "db" },
  { role: "worker", count: 140, prefix: "worker" },
  { role: "cache", count: 40, prefix: "cache" },
  { role: "gateway", count: 30, prefix: "gw" },
  { role: "queue", count: 30, prefix: "queue" },
] as const;

const APPS = ["Payments", "Ledger", "Checkout", "Identity", "Notify"];
const SITES = ["DC-01", "DC-02", "DC-03"];

function scenarioFor(index: number, hostname: string): Scenario {
  if (hostname === "api-017") return "critical_app";
  if (hostname === "db-042") return "warning_disk";
  if (hostname === "worker-086") return "stale";
  if (index % 67 === 0) return "stale";
  if (index % 41 === 0) return index % 82 === 0 ? "critical_disk" : "critical_app";
  if (index % 19 === 0) return "warning_cpu";
  if (index % 17 === 0) return "warning_disk";
  return "healthy";
}

function sampleId(index: number): string {
  const raw = `sample-${index.toString(16).padStart(4, "0")}-boomdock`;
  return `sample-${raw.slice(0, 18)}`;
}

export function metricsFor(index: number, hostname: string, role: string, scenario: Scenario) {
  const spread = (index * 17) % 100;
  let cpu = 18 + (spread % 25);
  const mem = 42 + (spread % 20);
  let disk = 34 + (spread % 18);
  let inode = 20 + (spread % 15);
  let io = 4 + (spread % 6);
  let readOnly = false;
  let appProbe: "pass" | "fail" = "pass";
  let appDetail = "HTTP 200";
  if (scenario === "warning_cpu") cpu = 84 + (spread % 5);
  if (scenario === "warning_disk") {
    disk = hostname === "db-042" ? 88 : 86;
    io = 62;
    inode = 71;
  }
  if (scenario === "critical_app") {
    cpu = hostname === "api-017" ? 28 : 33;
    disk = hostname === "api-017" ? 62 : 58;
    appProbe = "fail";
    appDetail = "HTTP 503";
  }
  if (scenario === "critical_disk") {
    if (index % 82 === 0) {
      readOnly = true;
      disk = 70;
    } else disk = 97;
    io = 240;
    inode = 96;
  }
  return {
    cpu,
    mem,
    disk,
    inode,
    io,
    readOnly,
    appProbe,
    appDetail,
    staleSeconds: scenario === "stale" ? 20 * 60 : 8,
    role,
  };
}

export function buildFleet(): Host[] {
  const hosts: Host[] = [];
  let index = 0;
  for (const plan of PLAN) {
    for (let n = 1; n <= plan.count; n += 1) {
      const hostname = `${plan.prefix}-${String(n).padStart(3, "0")}`;
      const scenario = scenarioFor(index, hostname);
      const metrics = metricsFor(index, hostname, plan.role, scenario);
      hosts.push({
        index,
        id: sampleId(index),
        hostname,
        role: plan.role,
        site: SITES[index % SITES.length],
        application: APPS[index % APPS.length],
        scenario,
        pinned: false,
        cpu: metrics.cpu,
        mem: metrics.mem,
        disk: metrics.disk,
        inode: metrics.inode,
        io: metrics.io,
        readOnly: metrics.readOnly,
        appProbe: metrics.appProbe,
        appDetail: metrics.appDetail,
        staleSeconds: metrics.staleSeconds,
        restarts: hostname === "api-017" ? 4 : hostname === "db-042" ? 1 : index % 11 === 0 ? 3 : 0,
        reboots: index % 13 === 0 ? 1 : 0,
      });
      index += 1;
    }
  }
  return hosts;
}

export function displayStatus(host: Host): Status {
  if (host.staleSeconds > 90 || host.scenario === "stale") return "unknown";
  if (host.scenario === "critical_app" || host.scenario === "critical_disk") return "critical";
  if (host.scenario === "warning_disk" || host.scenario === "warning_cpu") return "warning";
  return "healthy";
}

export function applyScenario(hosts: Host[], hostname: string, action: ScenarioAction): Host[] {
  const target = hosts.find((host) => host.hostname === hostname);
  if (!target) throw new Error("That name is not in the public sample. Real enrolled hosts are not loaded here.");
  const scenario: Scenario =
    action === "app_failure" ? "critical_app" : action === "disk_warning" ? "warning_disk" : action === "stale_collector" ? "stale" : "healthy";
  return hosts.map((host) => {
    if (host.hostname !== hostname) return host;
    const metrics = metricsFor(host.index, host.hostname, host.role, scenario);
    return { ...host, ...metrics, scenario, pinned: true };
  });
}

export function jitter(hosts: Host[], tick: number): Host[] {
  return hosts.map((host) => {
    if (host.scenario === "stale") return host;
    const wobble = ((tick + host.index) % 5) - 2;
    let cpu = host.cpu + (host.scenario === "healthy" || host.scenario === "warning_cpu" ? wobble * 0.4 : 0);
    if (host.scenario === "warning_cpu") cpu = Math.min(90, Math.max(82, cpu));
    else if (host.scenario === "healthy") cpu = Math.min(60, Math.max(8, cpu));
    else cpu = host.cpu;
    const metrics = metricsFor(host.index, host.hostname, host.role, host.scenario);
    return {
      ...host,
      cpu,
      disk: metrics.disk,
      inode: metrics.inode,
      io: metrics.io,
      readOnly: metrics.readOnly,
      appProbe: metrics.appProbe,
      appDetail: metrics.appDetail,
      staleSeconds: Math.min(20, host.staleSeconds),
    };
  });
}

export function counts(hosts: Host[]) {
  const tally = { critical: 0, warning: 0, healthy: 0, unknown: 0 };
  for (const host of hosts) tally[displayStatus(host)] += 1;
  return tally;
}

export const SERVICES: Record<string, Array<[string, string]>> = {
  api: [
    ["app-api.service", "Primary application unit for the API role."],
    ["nginx.service", "Reverse proxy in front of the API."],
    ["redis.service", "Cache dependency for the API role, not a CPU ranking."],
  ],
  db: [
    ["postgresql.service", "Primary datastore for the DB role."],
    ["pgbouncer.service", "Connection pool in front of Postgres."],
  ],
  worker: [
    ["app-worker.service", "Primary worker unit for the worker role."],
    ["redis.service", "Queue backend the worker consumes."],
  ],
  cache: [["redis.service", "Primary cache unit for the cache role."]],
  gateway: [["nginx.service", "Edge gateway unit."]],
  queue: [["redis.service", "Queue broker for the queue role."]],
};

export function diskBytes(host: Host) {
  const total = host.role === "db" ? 400 * 1024 ** 3 : 100 * 1024 ** 3;
  return { total, used: Math.round((total * host.disk) / 100) };
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
