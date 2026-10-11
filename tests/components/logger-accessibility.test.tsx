import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import {
  Field,
  DateInput,
  SimpleSelect,
  DeleteConfirmDialog,
} from "@/components/workout-logger/form-bits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MethodBlockDialog } from "@/components/workout-logger/method-block-dialog";
import { useMethodBlockEditor } from "@/hooks/use-method-block-editor";

it("names nested date/select/numeric/note controls and keeps repeated IDs unique", async () => {
  const { rerender } = render(
    <>
      <Field label="Date">
        <DateInput value="2026-10-11" onChange={() => {}} />
      </Field>
      <Field label="Type">
        <SimpleSelect value="Strength" onChange={() => {}} options={["Strength", "Climbing"]} />
      </Field>
      <Field label="Problems (optional)">
        <Input type="number" />
      </Field>
      <Field label="Notes">
        <Textarea />
      </Field>
      <Field label="Duration">
        <div>
          <Input aria-label="Hours" />
          <Input aria-label="Minutes" />
        </div>
      </Field>
      <Field label="Set 1">
        <Input />
      </Field>
      <Field label="Set 1">
        <Input />
      </Field>
    </>,
  );
  expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
  expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Problems (optional)" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Hours" })).toBeInTheDocument();
  const controls = [...document.querySelectorAll("input, textarea, button[role=combobox]")];
  const ids = controls.map((control) => control.id);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  const select = screen.getByRole("combobox", { name: "Type" });
  select.focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(await screen.findByRole("listbox")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(select).toHaveFocus();
  // Controls outside a Field retain their existing explicit label/ID contract.
  rerender(
    <>
      <label htmlFor="outside">Outside</label>
      <Input id="outside" />
    </>,
  );
  expect(screen.getByLabelText("Outside")).toHaveAttribute("id", "outside");
});

it("focuses the safe delete action and restores focus when dismissed by keyboard", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Delete entry</button>
        <DeleteConfirmDialog
          target={
            open
              ? { id: "entry", title: "Entry", description: "This entry will be removed." }
              : null
          }
          onCancel={() => setOpen(false)}
          onConfirm={() => {}}
        />
      </>
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Delete entry" });
  await userEvent.click(trigger);
  expect(
    await screen.findByRole("alertdialog", { name: "Delete this entry?" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("names the method selector and restores focus after the method editor closes", async () => {
  function Harness() {
    const editor = useMethodBlockEditor();
    return (
      <>
        <button onClick={editor.openCreate}>Add method</button>
        <MethodBlockDialog
          state={editor.state}
          methods={[]}
          entries={[]}
          blocks={[]}
          onClose={editor.close}
          onSave={() => {}}
        />
      </>
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Add method" });
  await userEvent.click(trigger);
  expect(await screen.findByRole("dialog", { name: "Add training method" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Method" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
