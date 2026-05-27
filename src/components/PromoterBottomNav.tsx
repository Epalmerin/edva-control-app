"use client";

import Link from "next/link";

export default function PromoterBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 text-white grid grid-cols-5 gap-1 p-2 md:hidden z-50">
      <Link href="/promoter" className="text-center text-[11px] py-2">
        Inicio
      </Link>

      <Link href="/promoter/attendance" className="text-center text-[11px] py-2">
        Asistencia
      </Link>

      <Link href="/promoter/sales" className="text-center text-[11px] py-2">
        Ventas
      </Link>

      <Link href="/promoter/incidences" className="text-center text-[11px] py-2">
        Incidencias
      </Link>

      <Link
        href="/promoter/supervisor-visits"
        className="text-center text-[11px] py-2"
      >
        Visitas
      </Link>
    </nav>
  );
}