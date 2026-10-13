"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";

// Keys that are hard to find on a phone keyboard. Only shown on touch screens.
const KEYS = ["(", ")", "{", "}", ";", "=", '"'];

// Deliberately small for first-year students: no autocomplete pop-ups, folding or search.
const extensions = [
  lineNumbers(),
  history(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  syntaxHighlighting(defaultHighlightStyle),
  javascript(),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Code editor" }),
  EditorView.theme({
    "&": { fontSize: "16px", backgroundColor: "var(--card)" }, // 16px stops iOS zooming in
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--font-mono), monospace", lineHeight: "1.6" },
    ".cm-gutters": { backgroundColor: "var(--muted)", color: "var(--muted-foreground)", border: "none" },
  }),
];

export function CodeEditor({ value, onChange, minHeight = "10rem" }: { value: string; onChange: (value: string) => void; minHeight?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          extensions,
          EditorView.theme({ ".cm-content, .cm-gutter": { minHeight } }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply changes that come from outside the editor (e.g. answers restored after a reload).
  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  function insert(key: string) {
    const v = view.current!;
    v.dispatch(v.state.replaceSelection(key));
    v.focus();
  }

  return (
    <div className="overflow-hidden rounded-2xl border focus-within:ring-3 focus-within:ring-ring/30">
      <div ref={host} />
      <div className="hidden gap-1 border-t bg-muted p-1.5 pointer-coarse:flex">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep the phone keyboard open
            onClick={() => insert(k)}
            className="h-9 flex-1 rounded-lg bg-background font-mono"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
