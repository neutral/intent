import { useState, type ReactNode } from "react";
import {
  Button, Checkbox, Disclosure, DisclosurePanel, Input, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text, TextArea, TextField,
} from "react-aria-components";
import { useNotice } from "./context";

type Variant = "primary" | "danger" | undefined;

/** A button whose action may take a moment: pending while it runs, and any refusal
 * reported in the notice, as every Editor action reports it. */
export function Action({ onAction, variant, isDisabled = false, children }: { onAction: () => unknown; variant?: Variant; isDisabled?: boolean; children: string }) {
  const notice = useNotice();
  const [pending, setPending] = useState(false);
  return (
    <Button className={`button${variant ? ` ${variant}` : ""}`} isDisabled={isDisabled} isPending={pending}
      onPress={async () => {
        setPending(true);
        try { await onAction(); } catch (error) { notice(error instanceof Error ? error.message : String(error), "error"); } finally { setPending(false); }
      }}>
      {children}
    </Button>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

interface FieldProps {
  label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; description?: string; isDisabled?: boolean; className?: string;
}

export function Field({ label, value, onChange, placeholder, description, isDisabled = false, className = "" }: FieldProps) {
  return (
    <TextField className={`field${className ? ` ${className}` : ""}`} value={value} onChange={onChange} isDisabled={isDisabled}>
      <Label className="field-label">{label}</Label>
      <Input className="input" placeholder={placeholder} autoComplete="off" spellCheck={false} />
      {description ? <Text slot="description" className="description">{description}</Text> : null}
    </TextField>
  );
}

/** A multi-line field; `source` sets the person's text in the fixed-width face. */
export function Area({ label, value, onChange, placeholder, description, source = false, rows = 3 }: FieldProps & { source?: boolean; rows?: number }) {
  return (
    <TextField className={`field area${source ? " wide" : ""}`} value={value} onChange={onChange}>
      <Label className="field-label">{label}</Label>
      {description ? <Text slot="description" className="description">{description}</Text> : null}
      <TextArea className={`input${source ? " source" : ""}`} placeholder={placeholder} rows={rows} spellCheck={source ? false : undefined} />
    </TextField>
  );
}

export function Choice({ label, value, onChange, options, isDisabled = false, labelHidden = false }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[]; isDisabled?: boolean; labelHidden?: boolean }) {
  return (
    <Select className="field select" selectedKey={value} onSelectionChange={key => { if (key !== null) onChange(String(key)); }} isDisabled={isDisabled} aria-label={labelHidden ? label : undefined}>
      {labelHidden ? null : <Label className="field-label">{label}</Label>}
      <Button className="select-button">
        <SelectValue />
        <span className="mark" aria-hidden="true">▾</span>
      </Button>
      <Popover className="popover">
        <ListBox className="options" items={options}>
          {option => <ListBoxItem className="option" id={option.id} textValue={option.name}>{option.name}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function Check({ isSelected, onChange, children }: { isSelected: boolean; onChange: (selected: boolean) => void; children: ReactNode }) {
  return (
    <Checkbox className="check" isSelected={isSelected} onChange={onChange}>
      {({ isSelected: selected }) => (
        <>
          <span className="box" aria-hidden="true">{selected ? "✓" : ""}</span>
          <span className="check-label">{children}</span>
        </>
      )}
    </Checkbox>
  );
}

/** A disclosure: a named part the reader opens when they need it. */
export function Fold({ title, children, defaultExpanded = false, className = "" }: { title: ReactNode; children: ReactNode; defaultExpanded?: boolean; className?: string }) {
  return (
    <Disclosure className={`fold${className ? ` ${className}` : ""}`} defaultExpanded={defaultExpanded}>
      {({ isExpanded }) => (
        <>
          <Button slot="trigger" className="fold-trigger">
            <span className="mark" aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
            <span>{title}</span>
          </Button>
          <DisclosurePanel className="fold-panel">{children}</DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}

/** Text drawn from a file (`raw`, the person's) or assembled by Intent (`data`). It can
 * scroll, so the keyboard can reach it. */
export function Pre({ kind, label, children }: { kind: "raw" | "data"; label?: string; children: ReactNode }) {
  return <pre className={kind} tabIndex={0} aria-label={label}>{children}</pre>;
}

export function Intro({ cap, title, children }: { cap: string; title: string; children?: ReactNode }) {
  return (
    <header className="intro">
      <p className="cap">{cap}</p>
      <h1>{title}</h1>
      {children ? <p className="lede">{children}</p> : null}
    </header>
  );
}
