import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/configApi.js", () => ({ configAPI: { request } }));
vi.mock("element-plus", () => ({ ElMessage: { error: vi.fn() } }));
import { useDashboardStore } from "@/stores/dashboardStore.js";

describe("failure detail loading", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });
  it("loads the selected database record including its request body", async () => {
    const detail = { id: 7, requestBody: '{"round":2}', errorStack: "trace" };
    request.mockResolvedValue({ success: true, data: detail });
    const store = useDashboardStore();
    await store.openFailureTrace({ id: 7 });
    expect(request).toHaveBeenCalledWith("/api/admin/dashboard/failures/7");
    expect(store.activeTrace).toEqual(detail);
    expect(store.loadingFailureTrace).toBe(false);
    expect(store.showTraceModal).toBe(true);
  });
  it("does not let an older response overwrite the newest selected failure", async () => {
    let resolveOld;
    request
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({
        success: true,
        data: { id: 2, requestBody: "new" },
      });
    const store = useDashboardStore();
    const old = store.openFailureTrace({ id: 1 });
    await store.openFailureTrace({ id: 2 });
    resolveOld({ success: true, data: { id: 1, requestBody: "old" } });
    await old;
    expect(store.activeTrace.id).toBe(2);
    expect(store.activeTrace.requestBody).toBe("new");
  });
});
