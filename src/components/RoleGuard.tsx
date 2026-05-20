"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RoleGuardProps = {
  allowedRoles: string[];
  children: React.ReactNode;
};

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        window.location.href = "/";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!profile || !allowedRoles.includes(profile.role)) {
        window.location.href = "/";
        return;
      }

      setAllowed(true);
      setChecking(false);
    };

    checkRole();
  }, [allowedRoles]);

  if (checking) {
    return (
      <main className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <p className="text-neutral-600 font-medium">Validando acceso...</p>
      </main>
    );
  }

  return allowed ? <>{children}</> : null;
}