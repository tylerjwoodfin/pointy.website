import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  JOIN_BUTTONS,
  LOBBY_START_BUTTONS,
  SessionEntryForm,
} from "./SessionEntryForm";

describe("SessionEntryForm", () => {
  test("requires a name before starting a session", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={LOBBY_START_BUTTONS}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
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
    });
  });

  test("join requires a name", () => {
    const onSubmit = jest.fn();
    render(
      <SessionEntryForm
        busy={false}
        buttons={JOIN_BUTTONS}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole("button", { name: /join as dev/i })).toBeDisabled();
    userEvent.type(screen.getByLabelText(/your name/i), "Cam");
    userEvent.click(screen.getByRole("button", { name: /join as qa/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      role: "qa",
      name: "Cam",
    });
  });
});
