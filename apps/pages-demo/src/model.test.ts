import { describe, expect, it } from "vitest";
import { answerQuestion } from "./analytics";
import { applyScenario, buildFleet, displayStatus, jitter } from "./model";

describe("public sample fleet", () => {
  const fleet = buildFleet();

  it("builds 500 labeled sample hosts with the showcase names", () => {
    expect(fleet).toHaveLength(500);
    expect(fleet.every((host) => host.id.startsWith("sample-"))).toBe(true);
    expect(fleet.find((host) => host.hostname === "api-017")?.scenario).toBe("critical_app");
    expect(fleet.find((host) => host.hostname === "db-042")?.scenario).toBe("warning_disk");
    expect(displayStatus(fleet.find((host) => host.hostname === "worker-086")!)).toBe("unknown");
  });

  it("applies a scenario only to the named sample host and keeps it through a tick", () => {
    const next = applyScenario(fleet, "api-001", "app_failure");
    const changed = next.find((host) => host.hostname === "api-001")!;
    expect(changed.pinned).toBe(true);
    expect(changed.appProbe).toBe("fail");
    expect(displayStatus(changed)).toBe("critical");
    expect(next.filter((host) => host.appProbe === "fail").length).toBe(fleet.filter((host) => host.appProbe === "fail").length + 1);
    const ticked = jitter(next, 3);
    expect(ticked.find((host) => host.hostname === "api-001")?.scenario).toBe("critical_app");
    expect(ticked.find((host) => host.hostname === "api-001")?.appProbe).toBe("fail");
  });

  it("rejects names that are not in the sample and reset restores the seed", () => {
    expect(() => applyScenario(fleet, "edge-real-01", "disk_warning")).toThrow(/public sample/);
    const pinned = applyScenario(fleet, "db-042", "recover");
    expect(displayStatus(pinned.find((host) => host.hostname === "db-042")!)).toBe("healthy");
    const restored = buildFleet();
    expect(restored.find((host) => host.hostname === "db-042")?.scenario).toBe("warning_disk");
  });

  it("answers guided questions without treating low CPU as best", () => {
    const peers = answerQuestion(fleet, "Best performing API servers this week");
    expect(peers.criteria).toMatch(/not the ranking key/i);
    expect(String(peers.rows[0]?.status)).toBe("healthy");
    const low = peers.rows.find((row) => row.hostname === "api-017");
    expect(low).toBeUndefined();
    const restarts = answerQuestion(fleet, "Service restarts this month");
    expect(Number(restarts.rows.find((row) => row.hostname === "api-017")?.restarts)).toBe(4);
    expect(answerQuestion(fleet, "please restart api-017 now").note).toMatch(/cannot restart/i);
  });
});
