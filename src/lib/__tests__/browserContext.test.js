import { afterEach, expect, it, vi } from "vitest";
import { collectBrowserContext } from "../browserContext.js";

afterEach(() => vi.unstubAllGlobals());
it("keeps a tab identity across reconnects and reports timezone and language", () => {
  const values = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("navigator", { language: "zh-CN" });
  vi.stubGlobal("crypto", { randomUUID: () => "tab-identity" });
  const first = collectBrowserContext();
  expect(collectBrowserContext()).toEqual(first);
  expect(first.id).toBe("tab-identity");
  expect(first.locale).toBe("zh-CN");
  expect(first.timezone).toBeTruthy();
});
it("still reports environment when session storage is unavailable", () => {
  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw new Error("blocked");
    },
  });
  vi.stubGlobal("navigator", { language: "en-US" });
  expect(collectBrowserContext()).toMatchObject({ id: null, locale: "en-US" });
});
