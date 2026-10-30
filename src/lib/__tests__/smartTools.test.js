import { describe, it, expect, vi } from "vitest";
import { getSmartToolNames, resolveSmartTools } from "../smartTools.js";
import { setContactorModel } from "../contactorModel.js";
const catalog = {
  "ai-plugin": { skill_mid_a: {}, search_mid_b: {} },
  "terminal-pty": { bash_mid_c: {}, read_screen_mid_d: {} },
  custom: { custom_mid_e: {} },
};
describe("smart mode", () => {
  it("includes AI and terminal tools in defaults and existing complete AI selections", () => {
    expect(getSmartToolNames(catalog)).toEqual([
      "skill_mid_a",
      "search_mid_b",
      "bash_mid_c",
      "read_screen_mid_d",
    ]);
    expect(
      resolveSmartTools(
        ["skill_mid_a", "search_mid_b", "custom_mid_e"],
        catalog,
      ),
    ).toEqual([
      "skill_mid_a",
      "search_mid_b",
      "custom_mid_e",
      "bash_mid_c",
      "read_screen_mid_d",
    ]);
  });
  it("does not pretend that selecting skill alone enables the terminal plugin", () => {
    expect(resolveSmartTools(["skill_mid_a"], catalog)).toEqual([
      "skill_mid_a",
    ]);
  });
  it("uses the same names for settings groups and the wire catalog", () => {
    const groups = Object.entries(catalog).map(([name, tools]) => ({
      name,
      tools: Object.keys(tools).map((name) => ({ name })),
    }));
    expect(getSmartToolNames(groups)).toEqual(getSmartToolNames(catalog));
  });
});
describe("Agent model selection", () => {
  it("persists to the server before changing the local Agent model", async () => {
    const contactor = {
      id: "a",
      platform: "agent",
      options: { provider: "old", model: "old" },
    };
    const api = {
      request: vi.fn(async () => {
        expect(contactor.options.model).toBe("old");
        return { data: { provider: "openai", model: "new" } };
      }),
    };
    const client = { saveNow: vi.fn() };
    await setContactorModel(contactor, "openai", "new", { api, client });
    expect(api.request).toHaveBeenCalledWith("/api/agents/a", {
      method: "PATCH",
      body: { provider: "openai", model: "new" },
    });
    expect(contactor.options.model).toBe("new");
    expect(client.saveNow).toHaveBeenCalledOnce();
  });
  it("retains the previous model if the server rejects the update", async () => {
    const contactor = { id: "a", platform: "agent", options: { model: "old" } };
    await expect(
      setContactorModel(contactor, "p", "new", {
        api: {
          request: async () => {
            throw new Error("rejected");
          },
        },
        client: {},
      }),
    ).rejects.toThrow("rejected");
    expect(contactor.options.model).toBe("old");
  });
});
