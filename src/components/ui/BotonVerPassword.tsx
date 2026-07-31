"use client";

import { Eye, EyeOff } from "lucide-react";

/** Toggle mostrar/ocultar contraseña, pensado como `trailing` de `<Input>`. */
export function BotonVerPassword({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-subtle-fg hover:text-fg"
    >
      {visible ? (
        <EyeOff size={18} strokeWidth={1.5} />
      ) : (
        <Eye size={18} strokeWidth={1.5} />
      )}
    </button>
  );
}
