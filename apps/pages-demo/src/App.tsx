import { useEffect, useMemo, useState } from "react";
import { CommandCenter } from "./CommandCenter";
import { answerQuestion } from "./analytics";
import { applyScenario, buildFleet, counts, diskBytes, displayStatus, formatBytes, jitter, SERVICES, type Host, type RolePreview, type ScenarioAction, type Status } from "./model";

type View = "mosaic" | "cards" | "list";
type Density = 10 | 20 | 100 | 500;
type Log = { at: string; text: string };

const FILL: Record<Status, string> = { critical: "critical", warning: "warning", healthy: "healthy", unknown: "unknown" };

function routeOf() {
  const raw = (location.hash || "#/").replace(/^#\/?/, "");
  const [name, id] = raw.split("/");
  return { name: name || "overview", id: id ? decodeURIComponent(id) : "" };
}

export function App() {
  const [role, setRole] = useState<RolePreview>(() => (sessionStorage.getItem("bwd-role-preview") === "admin" ? "admin" : "user"));
  const [hosts, setHosts] = useState<Host[]>(() => buildFleet());
  const [route, setRoute] = useState(routeOf);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<Log[]>([]);

  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener("hashchange", onHash);
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setHosts((current) => jitter(current, Date.now()));
    }, 2500);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.clearInterval(timer);
    };
  }, []);

  function choose(next: RolePreview) {
    sessionStorage.setItem("bwd-role-preview", next);
    setRole(next);
    if (next === "user" && route.name === "admin") location.hash = "#/";
  }

  function scenario(hostname: string, action: ScenarioAction) {
    try {
      setHosts((current) => applyScenario(current, hostname, action));
      setLog((current) => [{ at: new Date().toISOString(), text: `Simulated ${action} on ${hostname}. No disk, network, or command was touched.` }, ...current].slice(0, 12));
    } catch (error) {
      setLog((current) => [{ at: new Date().toISOString(), text: error instanceof Error ? error.message : "Scenario rejected." }, ...current]);
    }
  }

  function reset() {
    setHosts(buildFleet());
    setLog([{ at: new Date().toISOString(), text: "Public sample reset to the original 500 hosts. Nothing outside this browser page was changed." }]);
  }

  const tally = useMemo(() => counts(hosts), [hosts]);
  const host = hosts.find((item) => item.hostname === route.id);

  if (route.name === "command") return <CommandCenter />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}boondockecho-logo.jpg`} alt="" className="logo" />
          Boondockecho
        </div>
        <p className="muted">{role === "admin" ? "Admin preview" : "User preview"}</p>
        <nav className="nav" aria-label="Sample">
          <a className={route.name === "overview" ? "active" : ""} href="#/">Overview</a>
          <a className={route.name === "command" ? "active" : ""} href="#/command">Command center</a>
          <a href="#/servers">Servers</a>
          <a href="#/services">Services</a>
          <a href="#/disks">Disks</a>
          <a href="#/incidents">Incidents</a>
          <a href="#/intelligence">Intelligence</a>
          <a href="#/history">History</a>
          {role === "admin" ? <a className={route.name === "admin" ? "active" : ""} href="#/admin">Admin preview</a> : null}
        </nav>
        <p className="preview-note">Role preview only. This is not a sign-in, and this page is not access-controlled.</p>
      </aside>
      <main className="main">
        <div className="banner">
          <div className="row">
            <button type="button" className={role === "user" ? "on" : ""} onClick={() => choose("user")}>Preview as user</button>
            <button type="button" className={role === "admin" ? "on" : ""} onClick={() => choose("admin")}>Preview as admin</button>
          </div>
          <div className="demo-pill" data-testid="demo-badge">DEMO • SIMULATED DATA</div>
        </div>
        {route.name === "host" && host ? <HostDetail host={host} /> : null}
        {route.name === "host" && !host ? <p>That name is not in the public sample.</p> : null}
        {route.name === "incident" && host ? <Incident host={host} /> : null}
        {route.name === "servers" ? <Fleet hosts={hosts} tally={tally} initialView="list" tick={tick} /> : null}
        {route.name === "disks" ? <Fleet hosts={hosts} tally={tally} initialView="list" tick={tick} diskFirst /> : null}
        {route.name === "services" ? <Services hosts={hosts} /> : null}
        {route.name === "incidents" ? <Incidents hosts={hosts} /> : null}
        {route.name === "intelligence" ? <Intelligence hosts={hosts} /> : null}
        {route.name === "history" ? <History hosts={hosts} log={log} /> : null}
        {route.name === "admin" && role === "admin" ? <Admin hosts={hosts} log={log} onScenario={scenario} onReset={reset} /> : null}
        {route.name === "admin" && role !== "admin" ? <p>The admin preview is a label, not a permission. Switch the preview to see those sample screens.</p> : null}
        {route.name === "overview" || route.name === "" ? (
          <Overview hosts={hosts} tally={tally} tick={tick} role={role} log={log} onScenario={scenario} onReset={reset} />
        ) : null}
      </main>
    </div>
  );
}

function Overview({ hosts, tally, tick, role, log, onScenario, onReset }: { hosts: Host[]; tally: ReturnType<typeof counts>; tick: number; role: RolePreview; log: Log[]; onScenario: (hostname: string, action: ScenarioAction) => void; onReset: () => void }) {
  const alerts = hosts
    .filter((host) => displayStatus(host) === "critical" || displayStatus(host) === "warning")
    .sort((a, b) => (displayStatus(a) === "critical" ? 0 : 1) - (displayStatus(b) === "critical" ? 0 : 1))
    .slice(0, 4);
  const failing = hosts.find((host) => host.appProbe === "fail");
  const fullest = [...hosts].sort((a, b) => b.disk - a.disk)[0];
  return (
    <div>
      <h1>Infra overview</h1>
      <section className="card">
        <h2>Infra health</h2>
        <div className="counts">
          <div><div className="count">{hosts.length}</div><div className="muted">Total</div></div>
          <div><div className="count"><i className="dot healthy" />{tally.healthy}</div><div className="muted">Healthy</div></div>
          <div><div className="count"><i className="dot warning" />{tally.warning}</div><div className="muted">Warning</div></div>
          <div><div className="count"><i className="dot critical" />{tally.critical}</div><div className="muted">Critical</div></div>
          <div><div className="count"><i className="dot unknown" />{tally.unknown}</div><div className="muted">Unknown</div></div>
        </div>
        <div className="dist" data-testid="health-distribution">
          <i className="critical" style={{ width: `${(tally.critical / hosts.length) * 100}%` }} />
          <i className="warning" style={{ width: `${(tally.warning / hosts.length) * 100}%` }} />
          <i className="healthy" style={{ width: `${(tally.healthy / hosts.length) * 100}%` }} />
          <i className="unknown" style={{ width: `${(tally.unknown / hosts.length) * 100}%` }} />
        </div>
        <p className="note">Sample freshness: simulated browser timer, tick {tick}. Not a live collector.</p>
      </section>
      <section className="card" style={{ marginTop: 12 }} data-testid="critical-alerts">
        <h2>Latest critical alerts</h2>
        <p className="muted">Sample alerts. Opening one shows evidence in this browser only.</p>
        <div className="cards">
          {alerts.map((host) => (
            <a key={host.id} href={`#/incident/${host.hostname}`} className="card">
              <strong><i className={`dot ${FILL[displayStatus(host)]}`} />{host.hostname}</strong>
              <div className="muted">{host.appProbe === "fail" ? "App readiness failed" : host.readOnly ? "Read-only mount" : `Disk ${host.disk}%`}</div>
            </a>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Application and disk risk</h2>
        <p>{failing ? `${failing.hostname} ${failing.appDetail}` : "No failing application probe in the sample."}</p>
        <p className="muted">{fullest ? `Highest sample disk is ${fullest.disk}% on ${fullest.hostname}.` : "No disk sample."}</p>
      </section>
      <Fleet hosts={hosts} tally={tally} initialView="mosaic" tick={tick} />
      <Sandbox hosts={hosts} onScenario={onScenario} onReset={onReset} />
      <p className="note">{role === "user" ? "User preview cannot send a restart. This sample has no command channel." : "Admin preview still cannot send a command. Recovery stays off."}</p>
      {log[0] ? <p className="note" data-testid="scenario-log">{log[0].text}</p> : null}
    </div>
  );
}

function Fleet({ hosts, tally, initialView, tick, diskFirst = false }: { hosts: Host[]; tally: ReturnType<typeof counts>; initialView: View; tick: number; diskFirst?: boolean }) {
  const [view, setView] = useState<View>(initialView);
  const [density, setDensity] = useState<Density>(500);
  const [hostname, setHostname] = useState("");
  const [app, setApp] = useState("all");
  const [role, setRole] = useState("all");
  const [site, setSite] = useState("all");
  const [health, setHealth] = useState("all");
  const [wall, setWall] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWall(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const apps = [...new Set(hosts.map((host) => host.application))];
  const roles = [...new Set(hosts.map((host) => host.role))];
  const sites = [...new Set(hosts.map((host) => host.site))];
  const filtered = hosts.filter((host) => {
    if (hostname && !host.hostname.toLowerCase().includes(hostname.trim().toLowerCase())) return false;
    if (app !== "all" && host.application !== app) return false;
    if (role !== "all" && host.role !== role) return false;
    if (site !== "all" && host.site !== site) return false;
    if (health !== "all" && displayStatus(host) !== health) return false;
    return true;
  });
  const ordered = diskFirst ? [...filtered].sort((a, b) => b.disk - a.disk) : filtered;
  const cell = density === 500 ? 12 : density === 100 ? 18 : density === 20 ? 34 : 72;

  async function fullscreen(node: HTMLElement | null) {
    if (!node?.requestFullscreen) {
      setWall(true);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      setWall(true);
    }
  }

  const body = (
    <section className={wall ? "wall card" : "card"} data-testid="fleet-board">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2>Infra map</h2>
          <p className="muted">Sample colors. Gray is unknown or stale, not a proven outage. Tick {tick} is a browser timer, not a live collector.</p>
        </div>
        <div className="row">
          <span className="badge" data-testid="sim-live">Simulated live</span>
          <button type="button" data-testid="fullscreen" onClick={(event) => fullscreen(event.currentTarget.closest("section"))}>Full screen</button>
          {wall ? <button type="button" onClick={() => setWall(false)}>Close wallboard</button> : null}
        </div>
      </div>
      <div className="counts" data-testid="counts">
        <div><div className="count"><i className="dot critical" />{tally.critical}</div><div className="muted">Critical</div></div>
        <div><div className="count"><i className="dot warning" />{tally.warning}</div><div className="muted">Warning</div></div>
        <div><div className="count"><i className="dot healthy" />{tally.healthy}</div><div className="muted">Healthy</div></div>
        <div><div className="count"><i className="dot unknown" />{tally.unknown}</div><div className="muted">Unknown</div></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {([10, 20, 100, 500] as Density[]).map((value) => (
          <button key={value} type="button" className={density === value ? "on" : ""} data-testid={`density-${value}`} onClick={() => setDensity(value)}>{value}</button>
        ))}
        {(["mosaic", "cards", "list"] as View[]).map((value) => (
          <button key={value} type="button" className={view === value ? "on" : ""} data-testid={`view-${value}`} onClick={() => setView(value)}>{value}</button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input aria-label="Hostname" data-testid="filter-hostname" placeholder="Hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} />
        <select aria-label="Application" value={app} onChange={(event) => setApp(event.target.value)}><option value="all">Application</option>{apps.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Role" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">Role</option>{roles.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Site" value={site} onChange={(event) => setSite(event.target.value)}><option value="all">Site</option>{sites.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Health" value={health} onChange={(event) => setHealth(event.target.value)}><option value="all">Health</option><option>critical</option><option>warning</option><option>healthy</option><option>unknown</option></select>
      </div>
      <p className="note" data-testid="visible-count">Showing {ordered.length} of {hosts.length}</p>
      {view === "mosaic" ? (
        <div className="mosaic" data-testid="mosaic" data-host-count={ordered.length}>
          {ordered.map((item) => (
            <a key={item.id} className={`cell ${FILL[displayStatus(item)]}`} style={{ width: cell, height: cell }} href={`#/host/${item.hostname}`} title={item.hostname} aria-label={item.hostname} />
          ))}
        </div>
      ) : null}
      {view === "cards" ? (
        <div className="cards" data-testid="cards">
          {ordered.map((item) => (
            <a key={item.id} className="card" href={`#/host/${item.hostname}`}>
              <strong>{item.hostname}</strong>
              <div className="muted">{item.role} · {item.application} · {displayStatus(item)}</div>
            </a>
          ))}
        </div>
      ) : null}
      {view === "list" ? (
        <div style={{ overflowX: "auto" }} data-testid="list">
          <table>
            <thead><tr><th>Hostname</th><th>Role</th><th>App</th><th>Site</th><th>Health</th><th>CPU</th><th>Disk</th><th>Inodes</th><th>I/O</th></tr></thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={item.id}>
                  <td><a href={`#/host/${item.hostname}`}>{item.hostname}</a></td>
                  <td>{item.role}</td>
                  <td>{item.application}</td>
                  <td>{item.site}</td>
                  <td>{displayStatus(item)}</td>
                  <td>{item.cpu.toFixed(0)}%</td>
                  <td>{item.disk}%{item.readOnly ? " ro" : ""}</td>
                  <td>{item.inode}%</td>
                  <td>{item.io} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="note">DEMO • SIMULATED DATA. Simulated live updates stay in this tab. Remote commands are not available.</p>
    </section>
  );
  return body;
}

function Sandbox({ hosts, onScenario, onReset }: { hosts: Host[]; onScenario: (hostname: string, action: ScenarioAction) => void; onReset: () => void }) {
  const [name, setName] = useState("api-017");
  return (
    <section className="card" style={{ marginTop: 12 }} data-testid="sandbox">
      <h2>Sample scenarios</h2>
      <p className="muted">These buttons rewrite one sample host in the browser. They cannot see enrolled hosts, disks on a machine, or a network.</p>
      <div className="row">
        <select aria-label="Sample host" data-testid="scenario-host" value={name} onChange={(event) => setName(event.target.value)}>
          {hosts.filter((host) => ["api-017", "api-002", "db-042", "worker-086"].includes(host.hostname)).map((host) => (
            <option key={host.hostname}>{host.hostname}</option>
          ))}
        </select>
        <button type="button" data-testid="scenario-app" onClick={() => onScenario(name, "app_failure")}>App failure</button>
        <button type="button" data-testid="scenario-disk" onClick={() => onScenario(name, "disk_warning")}>Disk warning</button>
        <button type="button" data-testid="scenario-stale" onClick={() => onScenario(name, "stale_collector")}>Stale collector</button>
        <button type="button" data-testid="scenario-recover" onClick={() => onScenario(name, "recover")}>Recover</button>
        <button type="button" data-testid="scenario-reset" onClick={onReset}>Reset sample</button>
      </div>
    </section>
  );
}

function HostDetail({ host }: { host: Host }) {
  const disk = diskBytes(host);
  const units = SERVICES[host.role] ?? [];
  return (
    <div>
      <h1>{host.hostname}</h1>
      <p className="muted">{host.role} · {host.application} · {host.site} · {host.id}</p>
      <div className="counts">
        <div className="card">Health<br /><strong>{displayStatus(host)}</strong></div>
        <div className="card">CPU<br /><strong>{host.cpu.toFixed(0)}%</strong></div>
        <div className="card">Disk<br /><strong>{formatBytes(disk.used)} / {formatBytes(disk.total)}</strong></div>
        <div className="card">Probe<br /><strong>{host.appDetail}</strong></div>
      </div>
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Essential services</h2>
        <p className="muted">Role examples, not a CPU ranking. Sample text only.</p>
        {units.map(([unit, reason]) => (
          <p key={unit}><strong>{unit}</strong> · {host.appProbe === "fail" && unit.startsWith("app-") ? "failed in the sample" : "active in the sample"}<br /><span className="muted">{reason}</span></p>
        ))}
      </section>
      <p className="note">Inodes {host.inode}% · I/O {host.io} ms · mount {host.readOnly ? "read-only in the sample" : "writable in the sample"} · last sample {host.staleSeconds}s old in the simulation.</p>
    </div>
  );
}

function Incident({ host }: { host: Host }) {
  return (
    <div>
      <h1>Incident workspace</h1>
      <p><i className={`dot ${FILL[displayStatus(host)]}`} />{displayStatus(host)} · {host.hostname} · sample evidence</p>
      <div className="grid-2">
        <section className="card"><h2>Application probe</h2><p>{host.appDetail}</p><p className="muted">{host.appProbe === "fail" ? "Failing in the sample while the heartbeat story stays fresh." : "Not failing in the sample."}</p></section>
        <section className="card"><h2>Collector path</h2><p>{host.staleSeconds > 90 ? "Simulated stale" : "Simulated fresh"}</p><p className="muted">Not a Tailscale session and not a real collector.</p></section>
      </div>
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Timeline</h2>
        <p>Sample opened the {host.scenario.replaceAll("_", " ")} story for {host.hostname}.</p>
        <p className="muted">There is no acknowledge action here because this preview has no identity and no audit database.</p>
      </section>
    </div>
  );
}

function Incidents({ hosts }: { hosts: Host[] }) {
  const rows = hosts.filter((host) => displayStatus(host) !== "healthy");
  return (
    <div>
      <h1>Incidents</h1>
      <p className="muted">Derived from the sample. Critical and warning hosts are listed with stale hosts as unknown.</p>
      <div className="cards">
        {rows.slice(0, 60).map((host) => (
          <a key={host.id} className="card" href={`#/incident/${host.hostname}`}><strong>{host.hostname}</strong><div className="muted">{displayStatus(host)} · {host.application}</div></a>
        ))}
      </div>
    </div>
  );
}

function Services({ hosts }: { hosts: Host[] }) {
  const failing = hosts.filter((host) => host.appProbe === "fail").slice(0, 40);
  return (
    <div>
      <h1>Services</h1>
      <p className="muted">Sample units for hosts whose application probe is failing in the story.</p>
      {failing.map((host) => (
        <p key={host.id}><a href={`#/host/${host.hostname}`}>{host.hostname}</a> · {(SERVICES[host.role] ?? [])[0]?.[0]} · {host.appDetail}</p>
      ))}
    </div>
  );
}

function Intelligence({ hosts }: { hosts: Host[] }) {
  const [question, setQuestion] = useState("Best performing API servers this week");
  const [result, setResult] = useState(() => answerQuestion(hosts, "Best performing API servers this week"));
  return (
    <div>
      <h1>Intelligence</h1>
      <p className="muted">Guided parser over this sample. It is not a model call and it cannot run commands.</p>
      <div className="row">
        {["Best performing API servers this week", "Unhealthy Payments servers", "Servers for application Ledger", "Service restarts this month", "OS reboots this week"].map((example) => (
          <button key={example} type="button" onClick={() => { setQuestion(example); setResult(answerQuestion(hosts, example)); }}>{example}</button>
        ))}
      </div>
      <form className="row" style={{ marginTop: 8 }} onSubmit={(event) => { event.preventDefault(); setResult(answerQuestion(hosts, question)); }}>
        <input aria-label="Question" value={question} onChange={(event) => setQuestion(event.target.value)} style={{ minWidth: 280 }} />
        <button type="submit">Run guided query</button>
      </form>
      <section className="card" style={{ marginTop: 12 }} data-testid="analytics">
        <p>{result.criteria}</p>
        <p className="muted">{result.note}</p>
        {result.rows.map((row) => <p key={String(row.hostname)}><a href={`#/host/${row.hostname}`}>{String(row.hostname)}</a> · {Object.entries(row).filter(([key]) => key !== "hostname").map(([key, value]) => `${key} ${value}`).join(" · ")}</p>)}
      </section>
    </div>
  );
}

function History({ hosts, log }: { hosts: Host[]; log: Log[] }) {
  const restarts = hosts.filter((host) => host.restarts > 0).slice(0, 8);
  const reboots = hosts.filter((host) => host.reboots > 0).slice(0, 8);
  return (
    <div>
      <h1>History</h1>
      <p className="muted">Sample restart counts and sample reboot counts are separate. They were not read from a server.</p>
      <div className="grid-2">
        <section className="card"><h2>Service restarts</h2>{restarts.map((host) => <p key={host.id}>{host.hostname}: {host.restarts} sample restarts</p>)}</section>
        <section className="card"><h2>OS reboots</h2>{reboots.map((host) => <p key={host.id}>{host.hostname}: {host.reboots} sample reboot</p>)}</section>
      </div>
      <section className="card" style={{ marginTop: 12 }}><h2>Simulation log</h2>{log.length === 0 ? <p className="muted">No scenario has been applied in this tab.</p> : log.map((entry) => <p key={entry.at}>{entry.text}</p>)}</section>
    </div>
  );
}

function Admin({ hosts, log, onScenario, onReset }: { hosts: Host[]; log: Log[]; onScenario: (hostname: string, action: ScenarioAction) => void; onReset: () => void }) {
  return (
    <div>
      <h1>Admin preview</h1>
      <p className="preview-note">This screen is a preview of the admin layout. It does not authenticate you and it does not change the private app.</p>
      <div className="grid-2">
        <section className="card"><h2>Inventory</h2><p>{hosts.length} sample hosts. IDs start with sample- and are not server UUIDs from the private database.</p></section>
        <section className="card"><h2>Discovery</h2><p>No name lookup and no subnet scan run from this page.</p></section>
        <section className="card"><h2>Recovery</h2><p>Automatic recovery OFF. Host reboot OFF. There is no command button.</p></section>
        <section className="card"><h2>Access</h2><p>User and admin are labels in this tab. Switching them does not create a session.</p></section>
      </div>
      <Sandbox hosts={hosts} onScenario={onScenario} onReset={onReset} />
      <section className="card" style={{ marginTop: 12 }}><h2>Simulation notes</h2>{log.length === 0 ? <p className="muted">No simulated edits yet.</p> : log.map((entry) => <p key={entry.at}>{entry.text}</p>)}</section>
    </div>
  );
}
