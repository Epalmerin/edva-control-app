"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { supabase } from "@/lib/supabase";
import { downloadProtectedFile } from "@/lib/storage-files";

export default function ProtectedFileLink({ reference, className, children }: {
  reference: string;
  className?: string;
  children: ReactNode;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const open = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (opening) return;
    setOpening(true);
    setError("");
    // Open synchronously from the user's click so browsers allow the new tab.
    const viewer = window.open("about:blank", "_blank");
    if (viewer) viewer.opener = null;
    try {
      if (!viewer) throw new Error("Permite abrir una nueva pestaña para consultar el archivo.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Tu sesion ha expirado. Inicia sesion nuevamente.");
      const blob = await downloadProtectedFile(supabase, reference, process.env.NEXT_PUBLIC_SUPABASE_URL || "");
      if (viewer.closed) return;
      const objectUrl = URL.createObjectURL(blob);
      viewer.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (cause) {
      viewer?.close();
      setError(cause instanceof Error ? cause.message : "No fue posible abrir el archivo.");
    } finally {
      setOpening(false);
    }
  };

  return <>
    <a href="#" onClick={open} className={className} aria-disabled={opening}>
      {opening ? "Abriendo..." : children}
    </a>
    {error && <span role="alert" className="block mt-2 text-xs text-red-700">{error}</span>}
  </>;
}
