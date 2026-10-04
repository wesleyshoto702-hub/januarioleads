import { useEffect, useRef, useState } from "react";
import type { LeadChanceResult } from "./lead-chance";

export function ChanceBadge({
  chance,
}: {
  chance: LeadChanceResult;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="chance-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`chance-badge ${chance.band}`}
        aria-expanded={open}
        aria-label={`Chance ${chance.score}. Ver principais sinais.`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
      >
        <span>Chance</span>
        <strong>{chance.score}</strong>
      </button>

      {open && (
        <span className="chance-popover" role="note">
          <strong>Chance {chance.score}</strong>
          <small>
            Score interno de priorização comercial. Não é probabilidade de fechamento.
          </small>
          <span className="chance-popover-title">Principais sinais</span>
          <span className="chance-reasons">
            {chance.reasons.map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
