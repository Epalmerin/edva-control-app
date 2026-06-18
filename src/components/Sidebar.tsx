"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  userName?: string;
};

export default function Sidebar({
  userName = "Administrador",
}: SidebarProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <aside className="w-72 min-h-screen bg-neutral-900 text-white p-6 flex flex-col">
      <div className="mb-10">
        <h1 className="text-4xl font-bold">
          ed<span className="text-red-500">va</span>
        </h1>

        <p className="text-red-400 tracking-[0.3em] text-xs mt-2">
          MKT & PUBLICIDAD
        </p>
      </div>

      <div className="mb-8">
        <p className="text-sm text-neutral-400">Bienvenido</p>

        <h2 className="font-semibold text-lg">
          {userName}
        </h2>
      </div>

      <nav className="flex flex-col gap-3 flex-1">
        <Link
          href="/admin"
          className="bg-red-500 hover:bg-red-600 transition px-4 py-3 rounded-xl font-medium"
        >
          Dashboard
        </Link>

        <Link
          href="/admin/attendance"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Asistencia
        </Link>

        <Link
          href="/admin/store-visits"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Rutas de tienda
        </Link>

        <Link
          href="/admin/sales"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Ventas
        </Link>

        <Link
          href="/admin/intelligence/sears"
          className="bg-blue-900 hover:bg-blue-800 transition px-4 py-3 rounded-xl font-medium"
        >
          🛏️ Inteligencia Sears
        </Link>

        <Link
          href="/admin/incidences"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Incidencias
        </Link>

        <Link
          href="/admin/reports"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Reportes
        </Link>

        <Link
          href="/admin/employees"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Empleados
        </Link>

        <Link
          href="/admin/stores"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Tiendas
        </Link>

        <Link
          href="/admin/store-assignments"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Asignar tiendas
        </Link>

        <Link
          href="/admin/supervisor-visits"
          className="bg-neutral-800 hover:bg-neutral-700 transition px-4 py-3 rounded-xl"
        >
          Visitas supervisor
        </Link>
      </nav>

      <button
        onClick={handleLogout}
        className="mt-10 bg-white text-neutral-900 hover:bg-neutral-200 transition py-3 rounded-xl font-semibold"
      >
        Cerrar sesión
      </button>
    </aside>
  );
}