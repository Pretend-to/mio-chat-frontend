import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({
  default: vi.fn(),
}));

import Socket from "../websocket.js";

function createConnectedSocket() {
  return {
    connected: true,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe("Socket message lifecycle", () => {
  let client;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      location: { href: "https://chat.example.test/" },
    });
    client = new Socket("client-1", "token-1");
  });

  it.each([
    ["llm", "llm_message"],
    ["channel", "channel_message"],
  ])(
    "routes a %s response to its request listener exactly once",
    (protocol, protocolEvent) => {
      const requestListener = vi.fn();
      const protocolListener = vi.fn();
      client.on("request-1", requestListener);
      client.on(protocolEvent, protocolListener);
      client.pendingRequests.add("request-1");

      const message = { protocol, request_id: "request-1", data: { ok: true } };
      client.messageHandler(JSON.stringify(message));

      expect(requestListener).toHaveBeenCalledOnce();
      expect(requestListener).toHaveBeenCalledWith(message);
      expect(protocolListener).toHaveBeenCalledOnce();
      expect(protocolListener).toHaveBeenCalledWith(message);
      expect(client.pendingRequests.has("request-1")).toBe(false);
    },
  );

  it("rejects disconnected sends without leaving a pending request", async () => {
    client.pendingRequests.add("request-1");

    await expect(
      client.sendMessage({ request_id: "request-1" }),
    ).rejects.toThrow("Socket not connected");
    expect(client.pendingRequests.has("request-1")).toBe(false);
  });

  it("blocks duplicate in-flight request ids", async () => {
    client.socket = createConnectedSocket();
    client.pendingRequests.add("request-1");

    await expect(
      client.sendMessage({ request_id: "request-1" }),
    ).rejects.toThrow("Duplicate request_id: request-1");
    expect(client.socket.emit).not.toHaveBeenCalled();
  });

  it("sends persistence acknowledgements only while connected", () => {
    const socket = createConnectedSocket();
    client.socket = socket;

    client.ackMessage("contact-1", "message-1");

    expect(socket.emit).toHaveBeenCalledOnce();
    const [event, payload] = socket.emit.mock.calls[0];
    expect(event).toBe("message");
    expect(JSON.parse(payload)).toMatchObject({
      protocol: "llm",
      type: "ack_message",
      data: { contactorId: "contact-1", messageId: "message-1" },
    });

    socket.connected = false;
    client.ackMessage("contact-1", "message-2");
    expect(socket.emit).toHaveBeenCalledOnce();
  });

  it("queues an interrupt offline and flushes it after reconnection", () => {
    client.interruptGeneration("message-1", "contact-1");
    expect(client.pendingInterrupts.size).toBe(1);

    const socket = createConnectedSocket();
    client.socket = socket;
    client.sendPendingInterrupts();

    expect(socket.emit).toHaveBeenCalledWith("interruptGeneration", {
      contactorId: "contact-1",
      messageId: "message-1",
    });
    expect(client.pendingInterrupts.size).toBe(0);
  });
});
