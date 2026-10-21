import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PointingBlackjackSession } from "./PointingBlackjackSession";
import type { SessionState } from "./types";

jest.mock("react-router-dom", () => ({
  useParams: () => ({ sessionId: "room1234" }),
  useNavigate: () => jest.fn(),
}));

const mockSetFunNames = jest.fn();

let mockState: SessionState;

jest.mock("./PointingBlackjackProvider", () => ({
  usePointingBlackjack: () => ({
    state: mockState,
    lastError: null,
    joinSession: jest.fn(),
    createSession: jest.fn(),
    querySessionExists: jest.fn(() => new Promise(() => {})),
    clearLastError: jest.fn(),
    vote: jest.fn(),
    clearVote: jest.fn(),
    reveal: jest.fn(),
    newRound: jest.fn(),
    leaveTable: jest.fn(),
    setBrb: jest.fn(),
    setFunNames: mockSetFunNames,
    updateName: jest.fn(),
    connectionStatus: "open",
  }),
  readStoredIdentity: () => null,
}));

function sessionFor(me: SessionState["players"][number], funNames: boolean): SessionState {
  return {
    sessionId: "room1234",
    myPlayerId: me.id,
    revealed: false,
    gameOver: false,
    expiresAt: Date.now() + 60_000,
    funNames,
    players: [
      me,
      {
        id: "bob",
        name: "Bob",
        funTitle: "Sleepy Eagle",
        online: true,
        role: "dev",
      },
    ],
    voteByPlayer: {},
  };
}

function renderTable() {
  render(<PointingBlackjackSession />);
}

function playerLine(text: string) {
  return screen.getByText((_, node) => {
    return (
      node?.classList.contains("pb-player-line__name") === true &&
      node.textContent === text
    );
  });
}

describe("fun names at the table", () => {
  beforeEach(() => {
    mockSetFunNames.mockClear();
  });

  test("a BA sees Fun Names under the dealers and can turn them off", () => {
    mockState = sessionFor(
      {
        id: "ba",
        name: "Sam",
        funTitle: "Bold Dragon",
        online: true,
        role: "product",
      },
      true
    );
    renderTable();

    expect(playerLine("Bob the Sleepy Eagle")).toBeInTheDocument();
    expect(screen.getByText("the Sleepy Eagle")).toHaveClass("pb-player-line__fun");
    expect(screen.getByText("Shown as Sam the Bold Dragon")).toBeInTheDocument();
    const toggle = screen.getByRole("checkbox", { name: /fun names/i });
    expect(toggle).toBeChecked();
    expect(screen.getByRole("heading", { name: "Options" })).toBeInTheDocument();
    const dealers = screen.getByRole("heading", { name: "Dealers" });
    const options = screen.getByRole("heading", { name: "Options" });
    expect(
      dealers.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    userEvent.click(toggle);
    expect(mockSetFunNames).toHaveBeenCalledWith(false);
  });

  test("Tyler can toggle fun names, and unchecking shows real names", () => {
    mockState = sessionFor(
      {
        id: "tyler",
        name: "Tyler",
        funTitle: "Quiet Fern",
        online: true,
        role: "dev",
      },
      false
    );
    renderTable();

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Bob the Sleepy Eagle")).not.toBeInTheDocument();
    expect(screen.queryByText(/shown as/i)).not.toBeInTheDocument();
    const toggle = screen.getByRole("checkbox", { name: /fun names/i });
    expect(toggle).not.toBeChecked();
    userEvent.click(toggle);
    expect(mockSetFunNames).toHaveBeenCalledWith(true);
  });

  test("other players see fun names and no Options checkbox", () => {
    mockState = sessionFor(
      {
        id: "cam",
        name: "Cam",
        funTitle: "Swift Fox",
        online: true,
        role: "qa",
      },
      true
    );
    renderTable();

    expect(playerLine("Bob the Sleepy Eagle")).toBeInTheDocument();
    expect(screen.getByText("the Sleepy Eagle")).toHaveClass("pb-player-line__fun");
    expect(screen.queryByRole("checkbox", { name: /fun names/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Options" })).not.toBeInTheDocument();
  });
});
