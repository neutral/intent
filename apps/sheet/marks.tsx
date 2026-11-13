/* Marks beside the words they mark (handbook/practices/sheet.md). The word
   carries the meaning, so the mark is hidden from assistive technology. */

export const marks = {
  draft: "○",
  current: "●",
  superseded: "◐",
  retired: "◌",
  valid: "✓",
  complete: "✓",
  invalid: "✕",
  incomplete: "△",
  error: "✕",
  warning: "△",
  info: "○",
  changed: "△",
  related: "○",
  outgoing: "→",
  incoming: "←",
  missing: "✕",
  omitted: "△",
  saving: "⋯",
  saved: "✓",
  unsaved: "△",
  external: "↗",
} as const;

export type MarkName = keyof typeof marks;

/** A status: its mark and its word. `attention` draws both in red. */
export function State({ mark, children, attention = false, className = "" }: { mark: MarkName; children: string; attention?: boolean; className?: string }) {
  return (
    <span className={`state${attention ? " diff" : ""}${className ? ` ${className}` : ""}`}>
      <span className="mark" aria-hidden="true">{marks[mark]}</span>
      {children}
    </span>
  );
}

/** A lifecycle status as a mark and its word. */
export function Lifecycle({ status }: { status: string }) {
  const mark = (status in marks ? status : "draft") as MarkName;
  return <State mark={mark}>{status}</State>;
}
