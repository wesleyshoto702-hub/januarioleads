import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getValidSession, subscribeAuthChange } from "../../lib/auth";
export function PrivateWorkspace({ children }: { children: (userId: string) => React.ReactNode }) {
  const navigate = useNavigate();
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;
    let verificationSerial = 0;

    async function verify() {
      const currentVerification = ++verificationSerial;
      const session = await getValidSession().catch(() => null);
      if (!active || currentVerification !== verificationSerial) return;
      if (!session) {
        setAuthorizedUserId(null);
        setCheckingAccess(false);
        await navigate({ to: "/login", replace: true });
        return;
      }
      setAuthorizedUserId(session.user.id);
      setCheckingAccess(false);
    }

    void verify();
    const unsubscribe = subscribeAuthChange(() => {
      // Immediately hide the previous tenant while the new session is verified.
      setAuthorizedUserId(null);
      setCheckingAccess(true);
      void verify();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  if (checkingAccess || !authorizedUserId) {
    return (
      <main className="auth-loading" aria-live="polite">
        <Loader2 size={20} className="auth-spinner" />
        <span>Verificando acesso...</span>
      </main>
    );
  }

  return children(authorizedUserId);
}
