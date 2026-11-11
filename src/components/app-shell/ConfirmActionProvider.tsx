import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";

/** One accessible dialog for high-impact actions across Januário Leads. */
export type ConfirmationOptions = {
  title: string;
  description: string;
  subject?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
};
type ActiveConfirmation = ConfirmationOptions & { resolve: (value: boolean) => void };
type ConfirmAction = (options: ConfirmationOptions) => Promise<boolean>;
const ConfirmationContext = createContext<ConfirmAction | null>(null);

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveConfirmation | null>(null);
  const pending = useRef<ActiveConfirmation | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const finish = useCallback((accepted: boolean) => {
    const request = pending.current;
    pending.current = null;
    setActive(null);
    request?.resolve(accepted);
  }, []);

  const confirm = useCallback<ConfirmAction>((options) => new Promise<boolean>((resolve) => {
    if (pending.current) {
      resolve(false);
      return;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const request: ActiveConfirmation = { ...options, resolve };
    pending.current = request;
    setActive(request);
  }), []);

  useEffect(() => () => {
    pending.current?.resolve(false);
    pending.current = null;
  }, []);

  const danger = (active?.variant ?? "danger") === "danger";
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={Boolean(active)}
        onOpenChange={(open) => { if (!open) finish(false); }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="jl-confirm-overlay" />
          <AlertDialog.Content
            className="jl-confirm-dialog"
            onCloseAutoFocus={(event) => {
              // Imperative dialogs have no Radix Trigger; restore keyboard focus
              // to the original button if it is still present after the action.
              event.preventDefault();
              const target = previousFocus.current;
              previousFocus.current = null;
              if (target?.isConnected) target.focus();
            }}
          >
            <div className={"jl-confirm-icon " + (danger ? "danger" : "warning")} aria-hidden="true">
              {danger ? <Trash2 size={22} strokeWidth={1.85} /> :
                <AlertTriangle size={22} strokeWidth={1.85} />}
            </div>
            <AlertDialog.Title className="jl-confirm-title">
              {active?.title ?? "Confirmar ação"}
            </AlertDialog.Title>
            <AlertDialog.Description className="jl-confirm-description">
              {active?.description ?? "Deseja continuar?"}
            </AlertDialog.Description>
            {active?.subject && <div className="jl-confirm-subject" title={active.subject}>
              {active.subject}
            </div>}
            {danger && <p className="jl-confirm-caution">
              Essa ação pode não ser desfeita.
            </p>}
            <div className="jl-confirm-actions">
              <AlertDialog.Cancel
                type="button" className="jl-confirm-cancel"
                onClick={() => finish(false)}
              >
                {active?.cancelLabel ?? "Cancelar"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                type="button"
                className={"jl-confirm-accept " + (danger ? "danger" : "warning")}
                onClick={() => finish(true)}
              >
                {danger ? <Trash2 size={16} aria-hidden="true" /> : null}
                {active?.confirmLabel ?? (danger ? "Excluir" : "Confirmar")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmAction(): ConfirmAction {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("useConfirmAction deve estar dentro de ConfirmActionProvider");
  return confirm;
}
