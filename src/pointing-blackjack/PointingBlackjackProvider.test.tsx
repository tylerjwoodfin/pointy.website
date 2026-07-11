import React, { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import {
  PointingBlackjackProvider,
  usePointingBlackjack,
} from "./PointingBlackjackProvider";

type MessageHandler = (event: MessageEvent<string>) => void;
type CloseHandler = (event: CloseEvent) => void;
type OpenHandler = (event: Event) => void;
type ErrorHandler = (event: Event) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: OpenHandler | null = null;
  onmessage: MessageHandler | null = null;
  onclose: CloseHandler | null = null;
  onerror: ErrorHandler | null = null;
  sent: string[] = [];
  private listeners = {
    open: new Set<OpenHandler>(),
    close: new Set<CloseHandler>(),
  };

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: "open" | "close", handler: OpenHandler | CloseHandler) {
    if (type === "open") {
      this.listeners.open.add(handler as OpenHandler);
      return;
    }
    this.listeners.close.add(handler as CloseHandler);
  }

  removeEventListener(type: "open" | "close", handler: OpenHandler | CloseHandler) {
    if (type === "open") {
      this.listeners.open.delete(handler as OpenHandler);
      return;
    }
    this.listeners.close.delete(handler as CloseHandler);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    const event = {} as CloseEvent;
    this.onclose?.(event);
    for (const handler of [...this.listeners.close]) {
      handler(event);
    }
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    const event = new Event("open");
    this.onopen?.(event);
    for (const handler of [...this.listeners.open]) {
      handler(event);
    }
  }

  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

const TestHarness: React.FC = () => {
  const { joinSession, state } = usePointingBlackjack();

  useEffect(() => {
    joinSession("room-1234", "Cam", { playerId: "player-1" });
  }, [joinSession]);

  return <div>{state?.sessionId ?? "disconnected"}</div>;
};

describe("PointingBlackjackProvider", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
    MockWebSocket.instances = [];
    // @ts-expect-error test mock
    global.WebSocket = MockWebSocket;
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
    sessionStorage.clear();
  });

  test("rejoins the active session after the socket closes unexpectedly", async () => {
    await act(async () => {
      render(
        <PointingBlackjackProvider>
          <TestHarness />
        </PointingBlackjackProvider>
      );
      await Promise.resolve();
    });

    const firstSocket = MockWebSocket.instances[0];
    expect(firstSocket).toBeDefined();

    await act(async () => {
      firstSocket.open();
      await Promise.resolve();
    });

    expect(JSON.parse(firstSocket.sent[0])).toMatchObject({
      type: "join",
      sessionId: "room-1234",
      name: "Cam",
      playerId: "player-1",
    });

    await act(async () => {
      firstSocket.message({
        type: "state",
        state: {
          sessionId: "room-1234",
          myPlayerId: "player-1",
          revealed: false,
          gameOver: false,
          expiresAt: Date.now() + 60_000,
          players: [{ id: "player-1", name: "Cam", online: true }],
          voteByPlayer: {},
        },
      });
      await Promise.resolve();
    });

    expect(screen.getByText("room-1234")).toBeInTheDocument();

    await act(async () => {
      firstSocket.close();
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    const secondSocket = MockWebSocket.instances[1];
    expect(secondSocket).toBeDefined();

    await act(async () => {
      secondSocket.open();
      await Promise.resolve();
    });

    expect(JSON.parse(secondSocket.sent[0])).toMatchObject({
      type: "join",
      sessionId: "room-1234",
      name: "Cam",
      playerId: "player-1",
    });
  });
});
