import { useEffect, useRef, useState } from "react";
import { alertAt, countsOf, demoAnnouncement, demoEnabledLine, demoTestLine, eventsAt, linksAt, stageAt, tilesAt } from "./wallboard";

export function CommandCenter() {
  const [second, setSecond] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(true);
  const [chrome, setChrome] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [caption, setCaption] = useState("Announcements are off. Alerts stay on screen.");
  const seen = useRef(new Set<string>());
  const speechOnRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSupported("speechSynthesis" in window), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChrome((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setSecond((value) => value + 0.25), 250);
    return () => window.clearInterval(timer);
  }, [paused]);

  const stage = stageAt(second);
  const tiles = tilesAt(second);
  const links = linksAt(second);
  const events = eventsAt(second);
  const counts = countsOf(tiles);
  const alert = alertAt(second);

  function speak(text: string) {
    setCaption(text);
    if (!speechOnRef.current || mutedRef.current || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!alert || !speechOnRef.current) return;
    if (seen.current.has(alert.id)) return;
    seen.current.add(alert.id);
    speak(demoAnnouncement(alert));
  });

  return (
    <div className={`stage ${motion ? "" : "anim-off"}`} data-testid="command-center">
      <header className="stage-top">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}boondockecho-logo.jpg`} alt="" className="logo" />
          Boondockecho
        </div>
        <div>
          <div className="kicker">Infra command center</div>
          <h1 data-testid="wall-view">{stage.title}</h1>
        </div>
        <div className="demo-pill" data-testid="demo-badge">DEMO • SIMULATED DATA</div>
      </header>
      <section className="stat-row" data-testid="wall-infra">
        <Stat n={counts.total} label="Sample hosts" />
        <Stat n={counts.healthy} label="Healthy" />
        <Stat n={counts.warning} label="Warning" />
        <Stat n={counts.critical} label="Critical" />
        <Stat n={counts.unknown} label="Unknown" />
        <Spark values={tiles[0]?.spark ?? []} />
      </section>
      <div className="stage-main">
        <div className="rack" data-testid="rack">
          {tiles.map((tile) => (
            <div key={tile.name} className={`tile pulse-${tile.status}`} data-status={tile.status}>
              <strong>{tile.name}</strong>
              <span>{tile.app}</span>
              <em>{tile.tag}</em>
            </div>
          ))}
        </div>
        <div className="topo" data-testid="network">
          <svg viewBox="0 0 360 280" role="img" aria-label="Simulated network between three sites">
            <line className={links[0].down ? "link down" : "link flow"} x1="70" y1="70" x2="180" y2="200" />
            <line className={links[1].down ? "link down" : "link flow"} x1="180" y1="200" x2="290" y2="70" />
            <line className={links[2].down ? "link down" : "link flow"} x1="70" y1="70" x2="290" y2="70" />
            <Site x={70} y={70} name="DC-01" />
            <Site x={180} y={200} name="DC-02" />
            <Site x={290} y={70} name="DC-03" />
          </svg>
          <ul>
            {links.map((link) => (
              <li key={link.id}>{link.from} → {link.to}: {link.down ? "loss" : `${link.latencyMs} ms`} · simulated</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="alert-bar" data-testid="wall-alerts">
        {alert ? <strong key={alert.id} className="alert-in">{alert.hostname}: {alert.summary}</strong> : <span>No scripted alert in this moment.</span>}
      </div>
      <ol className="timeline" data-testid="timeline">
        {events.map((event) => <li key={event.id}>{event.text}</li>)}
      </ol>
      <p className="announce" data-testid="announcement">{caption}</p>
      {chrome ? (
        <div className="chrome row">
          <button type="button" data-testid="wall-pause" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => setMotion((value) => !value)}>{motion ? "Disable animations" : "Enable animations"}</button>
          <button type="button" data-testid="wall-enable" onClick={() => { speechOnRef.current = true; setSpeechOn(true); speak(demoEnabledLine()); }}>{speechOn ? "Announcements on" : "Enable announcements"}</button>
          <button type="button" onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }}>{muted ? "Unmute" : "Mute"}</button>
          <button type="button" data-testid="wall-test" onClick={() => { const was = speechOnRef.current; speechOnRef.current = true; speak(demoTestLine()); speechOnRef.current = was; }}>Test</button>
          <a href="#/">Exit</a>
          <span>{supported ? "Speech available after enable." : "Speech unavailable. Caption remains."}</span>
        </div>
      ) : <p className="hint">Esc shows controls. This is a scripted sample, not a live network.</p>}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="stat"><b>{n}</b><span>{label}</span></div>;
}

function Spark({ values }: { values: number[] }) {
  const d = values.map((value, index) => `${index === 0 ? "M" : "L"}${index * 8},${40 - value / 3}`).join(" ");
  return <svg className="spark" viewBox="0 0 140 40" aria-hidden><path d={d} /></svg>;
}

function Site({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="16" />
      <text x={x} y={y + 32} textAnchor="middle">{name}</text>
    </g>
  );
}
