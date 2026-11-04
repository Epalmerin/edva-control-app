"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CurrentAccessStatus } from "@/lib/access-status";

type RoleGuardProps = {
  allowedRoles: string[];
  children: React.ReactNode;
};

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    let running = false;
    let hadAccess = false;

    const checkRole = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (disposed) return;
        if (!sessionData.session?.user.id) {
          setAllowed(false);
          window.location.replace("/");
          return;
        }

        const { data: profile, error } = await supabase
          .rpc("get_current_access_status")
          .maybeSingle<CurrentAccessStatus>();
        if (disposed) return;
        if (error) throw error;

        if (!profile || profile.active !== true) {
          hadAccess = false;
          setAllowed(false);
          try {
            await supabase.auth.signOut({ scope: "local" });
          } finally {
            if (!disposed) window.location.replace("/");
          }
          return;
        }
        if (!profile.role || !allowedRoles.includes(profile.role)) {
          setAllowed(false);
          window.location.replace("/");
          return;
        }

        hadAccess = true;
        setMessage("");
        setAllowed(true);
        setChecking(false);
      } catch {
        // A transient recheck failure should not discard an active user's form.
        // The database independently rejects every operation after deactivation.
        if (!disposed && !hadAccess) {
          setAllowed(false);
          setChecking(false);
          setMessage("No se pudo comprobar tu acceso. Revisa tu conexión y vuelve a intentarlo.");
        }
      } finally {
        running = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkRole();
    };
    void checkRole();
    const timer = window.setInterval(() => void checkRole(), 30_000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [allowedRoles]);

  if (checking) {
    return <main className="min-h-screen bg-neutral-100 flex items-center justify-center">
      <p className="text-neutral-600 font-medium">Validando acceso...</p>
    </main>;
  }
  if (message) {
    return <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
      <p role="alert" className="text-neutral-600 font-medium">{message}</p>
    </main>;
  }
  return allowed ? <>{children}</> : null;
}
