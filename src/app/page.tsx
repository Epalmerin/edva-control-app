"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      setMessage("Usuario encontrado, pero no tiene perfil asignado.");
      setLoading(false);
      return;
    }

    if (profile.role === "ADMIN") {
  window.location.href = "/admin";
}

if (profile.role === "PROMOTOR") {
  window.location.href = "/promoter";
}

if (profile.role === "SUPERVISOR") {
  window.location.href = "/supervisor";
}

if (profile.role === "RH") {
  window.location.href = "/rh";
}
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neutral-800">
            ed<span className="text-red-500">va</span>
          </h1>
          <p className="text-red-500 tracking-[0.35em] text-sm mt-2">
            MKT & PUBLICIDAD
          </p>
          <h2 className="text-xl font-semibold mt-6 text-neutral-700">
            EDVA Control App
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Control de asistencia, ventas e incidencias
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Correo electrónico
            </label>
            <input
              type="email"
              className="w-full mt-1 px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-red-400"
              placeholder="correo@edva.com"
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
              className="w-full mt-1 px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {message && (
          <div className="mt-5 text-center text-sm font-medium text-neutral-700 bg-neutral-100 rounded-xl p-3">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}