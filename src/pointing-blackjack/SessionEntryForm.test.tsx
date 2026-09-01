import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  JOIN_BUTTONS,
  LOBBY_START_BUTTONS,
  SessionEntryForm,
} from "./SessionEntryForm";

jest.mock("./codename", () => ({
  uniqueCodename: () => "Swift Fox",
}));

describe("SessionEntryForm", () => {
  test("asks for a name by default and submits it with anonymousMode off", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={LOBBY_START_BUTTONS}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText(/anonymous mode/i)).not.toBeChecked();
    const startProduct = screen.getByRole("button", {
      name: /i'm a product owner/i,
    });
    expect(startProduct).toBeDisabled();

    userEvent.type(screen.getByLabelText(/your name/i), "Tyler");
    expect(startProduct).toBeEnabled();
    userEvent.click(startProduct);

    expect(onSubmit).toHaveBeenCalledWith({
      role: "product",
      name: "Tyler",
      anonymousMode: false,
    });
  });

  test("Anonymous Mode hides the name field and uses a generated nickname", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={LOBBY_START_BUTTONS}
        onSubmit={onSubmit}
      />
    );

    userEvent.click(screen.getByRole("checkbox", { name: /anonymous mode/i }));
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();

    userEvent.click(screen.getByRole("button", { name: /i'm a dev/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      role: "dev",
      name: "Swift Fox",
      anonymousMode: true,
    });
  });

  test("join without anonymous mode requires a name and hides the checkbox", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={JOIN_BUTTONS}
        lockedAnonymousMode={false}
        onSubmit={onSubmit}
      />
    );

    expect(
      screen.queryByRole("checkbox", { name: /anonymous mode/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join as dev/i })).toBeDisabled();

    userEvent.type(screen.getByLabelText(/your name/i), "Cam");
    userEvent.click(screen.getByRole("button", { name: /join as qa/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      role: "qa",
      name: "Cam",
      anonymousMode: false,
    });
  });

  test("join with anonymous mode skips the name field", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={JOIN_BUTTONS}
        lockedAnonymousMode
        existingNames={["Swift Fox"]}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /join as product/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      role: "product",
      name: "Swift Fox",
      anonymousMode: true,
    });
  });
});
