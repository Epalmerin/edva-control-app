"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se pudo validar la sesión.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      setMessage("No se encontró perfil.");
      setLoading(false);
      return;
    }

    const role = String(profile.role || "").trim().toUpperCase();

    if (role === "ADMIN") {
      router.push("/admin");
    } else if (role === "PROMOTOR") {
      router.push("/promoter");
    } else if (role === "SUPERVISOR") {
      router.push("/supervisor");
    } else if (role === "SUPERVISOR_VILLARREAL") {
      router.push("/supervisor/villarreal");
    } else if (role === "RH") {
      router.push("/rh");
    } else {
      setMessage(`Rol no autorizado: ${role}`);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 md:p-10">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-5xl font-black tracking-tight text-neutral-900">
            ed<span className="text-red-500">va</span>
          </h1>

          <p className="text-red-400 tracking-[0.35em] text-[10px] md:text-xs mt-2 text-center">
            MKT & PUBLICIDAD
          </p>

          <h2 className="text-2xl font-bold text-neutral-800 mt-8 text-center">
            EDVA Control App
          </h2>

          <p className="text-sm text-neutral-500 mt-2 text-center">
            Control de asistencia, ventas e incidencias
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Correo electrónico
            </label>

            <input
              type="email"
              placeholder="correo@edva.com"
              className="w-full mt-2 px-4 py-4 border border-neutral-300 rounded-2xl outline-none focus:ring-2 focus:ring-red-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">
              Contraseña
            </label>

            <input
              type="password"
              placeholder="Tu contraseña"
              className="w-full mt-2 px-4 py-4 border border-neutral-300 rounded-2xl outline-none focus:ring-2 focus:ring-red-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 transition text-white font-bold py-4 rounded-2xl disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {message && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-sm text-center">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}