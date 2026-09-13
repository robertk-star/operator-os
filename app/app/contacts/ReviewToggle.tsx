"use client";

export function ReviewToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, whiteSpace: "nowrap" }}>
      <span>{checked ? "Reviewed" : "Not reviewed"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          border: 0,
          padding: 3,
          cursor: "pointer",
          background: checked ? "#17243f" : "#d8dfe2",
        }}
      >
        <span
          style={{
            display: "block",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            marginLeft: checked ? 18 : 0,
          }}
        />
      </button>
    </label>
  );
}
