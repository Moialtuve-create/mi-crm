/**
 * Grupo de chips de selección única y alternable (design.md §8).
 * Click en el chip activo lo deselecciona (→ null). Se usa para Canal (opcional,
 * admite null) y para Estado en edición (el llamador ignora el null para no vaciarlo).
 */

type Opcion<T extends string> = { value: T; label: string };

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Opcion<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const activo = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(activo ? null : o.value)}
            className={`focus-ring rounded-md border px-3.5 py-2 text-[14px] font-medium transition-colors ${
              activo
                ? "border-primary bg-primary-subtle text-primary"
                : "border-line-strong bg-surface text-muted-fg hover:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
