"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        window.location.href = "/";
        return;
      }

      setChecking(false);
    };

    checkSession();
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-100">
        <p className="text-neutral-500 font-semibold">Validando acceso...</p>
      </main>
    );
  }

  return <>{children}</>;
}