import type { Host } from "./model";
import { displayStatus } from "./model";

export type Intent =
  | { type: "top_peers"; role?: string; application?: string }
  | { type: "bad_health"; role?: string; application?: string }
  | { type: "app_servers"; application?: string }
  | { type: "service_restarts" }
  | { type: "os_reboots" }
  | { type: "unsupported"; message: string };

const ROLES: Record<string, string> = {
  api: "api",
  database: "db",
  db: "db",
  worker: "worker",
  cache: "cache",
  gateway: "gateway",
  queue: "queue",
};

export function parseQuestion(input: string): Intent {
  const text = input.trim().toLowerCase();
  if (!text) return { type: "unsupported", message: "Enter a supported sample question." };
  if (/\b(restart|reboot|systemctl|bash)\b/.test(text) && /\b(now|please|run|execute)\b/.test(text) && !/count|restarts|reboots/.test(text)) {
    return { type: "unsupported", message: "This sample cannot restart anything. Questions stay read-only." };
  }
  const role = text.split(/[^a-z0-9]+/).map((token) => ROLES[token]).find(Boolean);
  const apps = ["Payments", "Ledger", "Checkout", "Identity", "Notify"];
  const application = apps.find((name) => text.includes(name.toLowerCase()));
  if (/reboot/.test(text)) return { type: "os_reboots" };
  if (/restart/.test(text)) return { type: "service_restarts" };
  if (/bad health|unhealthy|critical|failing/.test(text)) return { type: "bad_health", role, application };
  if (/servers for|application/.test(text)) return { type: "app_servers", application };
  if (/best|top|performing|peer/.test(text)) return { type: "top_peers", role, application };
  return { type: "unsupported", message: "That question is outside the guided sample parser." };
}

export function answerQuestion(hosts: Host[], question: string): {
  intent: Intent;
  criteria: string;
  rows: Array<Record<string, string | number>>;
  note: string;
} {
  const intent = parseQuestion(question);
  if (intent.type === "unsupported") {
    return { intent, criteria: "No rows were invented.", rows: [], note: intent.message };
  }
  let cohort = hosts;
  if ("role" in intent && intent.role) cohort = cohort.filter((host) => host.role === intent.role);
  if ("application" in intent && intent.application) cohort = cohort.filter((host) => host.application === intent.application);
  if (intent.type === "app_servers" && !intent.application) {
    return { intent, criteria: "Name a sample application.", rows: [], note: "No application was named, so no hosts were invented." };
  }
  if (intent.type === "service_restarts" || intent.type === "os_reboots") {
    const rows = cohort
      .filter((host) => (intent.type === "service_restarts" ? host.restarts > 0 : host.reboots > 0))
      .sort((a, b) => (intent.type === "service_restarts" ? b.restarts - a.restarts : b.reboots - a.reboots))
      .slice(0, 12)
      .map((host) => ({ hostname: host.hostname, role: host.role, restarts: host.restarts, reboots: host.reboots }));
    return {
      intent,
      criteria: intent.type === "service_restarts" ? "Sample service-restart counts. OS reboots are separate and are not included." : "Sample OS reboot counts. Service restarts are not counted as reboots.",
      rows,
      note: "These figures are baked into the public sample. They are not measurements from a collector.",
    };
  }
  const ranked = cohort
    .map((host) => {
      const status = displayStatus(host);
      const score = (status === "healthy" ? 70 : status === "warning" ? 35 : status === "critical" ? 5 : 20) + (host.appProbe === "pass" ? 20 : 0) - host.restarts * 2;
      return { host, score, status };
    })
    .sort((a, b) => b.score - a.score);
  const picked = intent.type === "bad_health" ? ranked.filter((row) => row.status !== "healthy") : ranked;
  return {
    intent,
    criteria: "Same-role sample comparison using health, the app probe, and restart counts. Lowest CPU is not the ranking key.",
    rows: picked.slice(0, 12).map((row) => ({
      hostname: row.host.hostname,
      role: row.host.role,
      application: row.host.application,
      status: row.status,
      score: row.score,
      cpu: row.host.cpu,
    })),
    note: "Coverage is the whole in-browser sample. There is no private history behind it.",
  };
}
