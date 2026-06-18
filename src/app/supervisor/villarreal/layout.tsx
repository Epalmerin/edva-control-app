"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;

      if (!userId) {
        window.location.href = "/";
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      const role = profile.role?.toUpperCase();

      if (role !== "ADMIN" && role !== "SUPERVISOR_VILLARREAL") {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      setAllowed(true);
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

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}