// Text rules that need nothing from the host, so that a browser can load them as they are: white space, case and length.

// White space is the space and the tab only.
export const trim = (s) => s.replace(/^[ \t]+|[ \t]+$/g, '');
export const trimEnd = (s) => s.replace(/[ \t]+$/, '');
export const isBlank = (s) => trim(s) === '';
export const lower = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
export const collapse = (s) => s.replace(/[ \t]+/g, ' ');

/** Characters are Unicode scalar values. */
export const length = (s) => { let n = 0; for (const _ of s) n++; return n; };
