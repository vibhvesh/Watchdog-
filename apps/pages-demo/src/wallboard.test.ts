import { describe, expect, it } from "vitest";
import { alertAt, demoAnnouncement, nextViewLabel, stageAt, stepIndex, tilesAt, unseenAlerts, WALL_VIEWS } from "./wallboard";

describe("command center rotation", () => {
  it("cycles four views and announces each alert once", () => {
    expect(WALL_VIEWS).toHaveLength(4);
    expect(stepIndex(3, 1)).toBe(0);
    expect(nextViewLabel(2)).toBe("Disk and risk");
    const fresh = unseenAlerts(new Set(["a"]), [
      { id: "a", hostname: "api-017", summary: "old" },
      { id: "b", hostname: "api-002", summary: "new" },
    ]);
    expect(fresh).toHaveLength(1);
    expect(demoAnnouncement(fresh[0])).toContain("Demo.");
    expect(stageAt(25).id).toBe("app");
    expect(tilesAt(60).find((tile) => tile.name === "db-042")?.tag).toBe("BACK");
    expect(alertAt(25)?.id).toBe("demo-app-api-017");
  });
});