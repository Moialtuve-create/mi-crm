"use client";

import { useId } from "react";
import { CircleAlert } from "lucide-react";

/**
 * Input de un solo código de 6 dígitos (MOI-115). Deliberadamente UN solo `<input>`, no
 * 6 cajas separadas: 6 cajas rompen el pegado del código, el autofill de iOS/Android
 * (`autoComplete="one-time-code"`) y los lectores de pantalla.
 */
export function CodigoInput({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const msgId = `${id}-msg`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[14px] font-medium">
        Código de 6 dígitos
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? msgId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className={`tnum focus-ring h-12 w-full rounded-md border bg-surface text-center text-[22px] tracking-[0.5em] placeholder:text-subtle-fg ${
          error ? "border-error" : "border-line-strong"
        }`}
      />
      {error ? (
        <p id={msgId} className="flex items-center gap-1 text-[13px] text-error-fg">
          <CircleAlert size={13} strokeWidth={2} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
