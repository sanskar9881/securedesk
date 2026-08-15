/**
 * The three consoles SecureDesk offers, and the control for picking one.
 *
 * Shared by sign-in and sign-up so the two screens can never drift apart in
 * wording, order, or styling — they are the same question asked at two
 * different moments:
 *
 *   sign-up  → which role the new account is created with
 *   sign-in  → which console the existing account means to open
 *
 * On SIGN-IN this is never an authorisation control: the server signs the
 * token with the role held in the database regardless of what is picked, and
 * uses this only to reject a mismatch (see `expected_role` in routes/auth.py).
 * On SIGN-UP it does determine the stored role, so the server validates it
 * against this same set before writing it.
 */

export const ROLES = [
  { id: "admin", label: "Administrator", hint: "Full organisation control" },
  { id: "manager", label: "Manager", hint: "Your team's activity" },
  { id: "user", label: "Employee", hint: "Your own workspace" },
] as const;

export type Role = (typeof ROLES)[number]["id"];

/** Narrow an arbitrary server/user string to a role, defaulting to employee. */
export function toRole(value: unknown): Role {
  const v = String(value ?? "").toLowerCase();
  return ROLES.some((r) => r.id === v) ? (v as Role) : "user";
}

export default function RoleChoice({
  value,
  onChange,
  legend,
}: {
  value: Role;
  onChange: (role: Role) => void;
  legend: string;
}) {
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={legend}>
        {ROLES.map((r) => {
          const on = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={r.hint}
              onClick={() => onChange(r.id)}
              className="rounded px-2 py-2 text-[12.5px] font-medium border transition-colors text-center"
              style={{
                background: on ? "var(--accent-wash)" : "transparent",
                borderColor: on ? "var(--accent-line)" : "var(--line-2)",
                color: on ? "var(--accent)" : "var(--text-3)",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-4)" }}>
        {ROLES.find((r) => r.id === value)?.hint}
      </p>
    </fieldset>
  );
}
