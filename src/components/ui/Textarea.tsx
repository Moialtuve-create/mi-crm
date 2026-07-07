import { useId, type TextareaHTMLAttributes } from "react";

/** Textarea etiquetado (mismos tokens que Input; alto mínimo, redimensionable en vertical). */
export function Textarea({
  label,
  className = "",
  id,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={areaId} className="block text-[14px] font-medium">
          {label}
        </label>
      ) : null}
      <textarea
        id={areaId}
        rows={rows}
        className={`focus-ring min-h-[84px] w-full resize-y rounded-md border border-line-strong bg-surface px-3.5 py-3 text-[15px] placeholder:text-subtle-fg ${className}`}
        {...props}
      />
    </div>
  );
}
