"use client";

export function ReviewToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="review-toggle">
      <span>{checked ? "Reviewed" : "Not reviewed"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? "switch on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </label>
  );
}
