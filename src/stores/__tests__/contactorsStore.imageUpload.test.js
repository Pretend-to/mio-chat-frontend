import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@/lib/runtime.js", () => ({
  client: { setLocalStorage: vi.fn() },
  config: { baseConfig: {} },
}));
vi.mock("@/lib/groupGateway.js", () => ({ resolveUnhandledMentions: vi.fn() }));
vi.mock("@/lib/clientSettings.js", () => ({
  addGlobalMemoryItem: vi.fn(),
  updateGlobalMemoryItem: vi.fn(),
  deleteGlobalMemoryItem: vi.fn(),
}));

import { useContactorsStore } from "@/stores/contactorsStore.js";

/**
 * 回归背景：
 * presend() 产出的 container 会被 message.upsert 深拷贝进消息链（unmarkRaw），
 * 因此 container 与链内对象不再同一引用。
 * 图片上传完成后若只改 `container.content[i].data.file`，链内仍残留 blob: 本地地址，
 * 之后每轮请求都会把 blob: 当图片发给模型 -> 上游 400 Invalid base64 data。
 * 正确做法是像 uploadDocumentFile() 那样用 message.patch 把 content 回写。
 */
describe("contactorsStore 图片上传回写", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function seed() {
    const store = useContactorsStore();
    store.loadContactors([
      { id: "c1", platform: "openai", name: "c", title: "t" },
    ]);
    return { store, contactor: store.contactors["c1"] };
  }

  it("upsert 会深拷贝：直接改 container 不会影响链内内容（抗重复问题）", () => {
    const { store, contactor } = seed();
    const container = {
      id: "m1",
      role: "user",
      status: "uploading",
      time: Date.now(),
      content: [
        { type: "image", data: { file: "blob:http://127.0.0.1:3000/abc" } },
      ],
    };
    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: contactor.id,
      message: container,
    });

    const inChain = contactor.messageChain[0];
    expect(container).not.toBe(inChain);
    expect(container.content[0]).not.toBe(inChain.content[0]);

    // 直接改游离对象 —— 链内不会变（这就是 blob: 残留的原因）
    container.content[0].data.file = "http://127.0.0.1:3080/p/img?hash=deadbeef";
    expect(inChain.content[0].data.file).toBe(
      "blob:http://127.0.0.1:3000/abc",
    );
  });

  it("通过 message.patch 回写 content 后，链内应换成远端 URL（修复路径）", () => {
    const { store, contactor } = seed();
    const container = {
      id: "m1",
      role: "user",
      status: "uploading",
      time: Date.now(),
      content: [
        { type: "image", data: { file: "blob:http://127.0.0.1:3000/abc" } },
      ],
    };
    store.applyMessageEvent({
      type: "message.upsert",
      contactorId: contactor.id,
      message: container,
    });

    const remoteUrl = "http://127.0.0.1:3080/p/img?hash=deadbeef";
    container.content[0].data.file = remoteUrl;
    const content = container.content.map((block) => ({
      ...block,
      data: { ...block.data },
    }));
    store.applyMessageEvent({
      type: "message.patch",
      contactorId: contactor.id,
      messageId: container.id,
      patch: { content, status: "pending" },
    });

    const inChain = contactor.messageChain[0];
    expect(inChain.content[0].data.file).toBe(remoteUrl);
    expect(inChain.status).toBe("pending");
  });
});
