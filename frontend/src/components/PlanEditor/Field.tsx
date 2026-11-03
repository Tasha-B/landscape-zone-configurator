import { useId, useState, type KeyboardEvent } from "react";
import { FIELD_CLASS, LABEL_CLASS } from "./fieldStyles";

interface FieldProps {
  label: string;
  // The saved value; the field follows it until the person has typed something
  value: string;
  // Called with the trimmed text when the field is left or Enter is pressed,
  // only if it changed and passes the checks
  onCommit: (value: string) => void;
  requiredMessage: string;
  // A message when the text is not acceptable, null when it is
  validate?: (value: string) => string | null;
  multiline?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
}

// A text field that saves once, when the person is done with it, not on
// every keystroke. An empty or invalid text is not sent: the field says why
// and keeps the text, so it can be fixed.
export default function Field({
  label,
  value,
  onCommit,
  requiredMessage,
  validate,
  multiline = false,
  maxLength,
  inputMode,
}: FieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  // A new saved value (another viewer's change, a reload) replaces the text,
  // unless the person has typed something: that stays, and leaving the field
  // saves it. Adjusted during render, as React recommends for state that
  // follows props.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (draft === seen) {
      setDraft(value);
      setError(null);
    }
  }

  function commit() {
    const text = draft.trim();
    const problem = text === "" ? requiredMessage : (validate?.(text) ?? null);
    setError(problem);
    if (problem) return;
    setDraft(text);
    if (text !== value) onCommit(text);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      commit();
    }
  }

  const shared = {
    id,
    value: draft,
    maxLength,
    "aria-invalid": error !== null,
    "aria-describedby": error ? `${id}-error` : undefined,
    onBlur: commit,
    className: FIELD_CLASS,
  };
  return (
    <div className={LABEL_CLASS}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...shared} rows={3} onChange={(event) => setDraft(event.target.value)} />
      ) : (
        <input {...shared} inputMode={inputMode} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} />
      )}
      {error && (
        <p id={`${id}-error`} className="font-normal text-error">
          {error}
        </p>
      )}
    </div>
  );
}
