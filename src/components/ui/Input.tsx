import {
  useId,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { CircleAlert } from "lucide-react";

type IconoLucide = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}>;

/**
 * Input etiquetado del design system (48px, radio 6px, anillo de foco verde).
 * Soporta icono izquierdo, contenido a la derecha (p. ej. botón limpiar), texto de
 * ayuda y estado de error (borde rojo + mensaje con icono).
 */
export function Input({
  label,
  icon: Icon,
  error,
  helper,
  trailing,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: IconoLucide;
  error?: string;
  helper?: string;
  trailing?: ReactNode;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  const hayMensaje = Boolean(error || helper);

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-[14px] font-medium">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-fg">
            <Icon size={18} strokeWidth={1.5} />
          </span>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hayMensaje ? msgId : undefined}
          className={`focus-ring h-12 w-full rounded-md border bg-surface px-3.5 text-[15px] placeholder:text-subtle-fg ${
            Icon ? "pl-10" : ""
          } ${trailing ? "pr-11" : ""} ${
            error ? "border-error" : "border-line-strong"
          } ${className}`}
          {...props}
        />
        {trailing ? (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </div>
      {error ? (
        <p
          id={msgId}
          className="flex items-center gap-1 text-[13px] text-error-fg"
        >
          <CircleAlert size={13} strokeWidth={2} />
          {error}
        </p>
      ) : helper ? (
        <p id={msgId} className="text-[13px] text-muted-fg">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
