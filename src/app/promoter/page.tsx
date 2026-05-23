"use client";

import Link from "next/link";
import PromoterBottomNav from "@/components/PromoterBottomNav";

export default function PromoterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-200 pb-24">
      
      <div className="max-w-md mx-auto px-5 pt-6">

        {/* HEADER */}

        <div className="bg-neutral-900 text-white rounded-[32px] p-7 shadow-2xl border border-neutral-800">
          
          <div className="flex items-center justify-between">
            
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Edva
              </h1>

              <p className="text-neutral-400 mt-1 text-sm">
                Control App · Promotor
              </p>
            </div>

            <div className="bg-red-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl"></span>
            </div>

          </div>

        </div>

        {/* MODULOS */}

        <div className="mt-8 space-y-5">

          {/* ASISTENCIA */}

          <Link
            href="/promoter/attendance"
            className="group block"
          >
            <div className="bg-white rounded-[28px] border border-neutral-200 shadow-lg p-6 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
              
              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">
                    Asistencia
                  </h2>

                  <p className="text-neutral-500 mt-2 text-sm">
                    Entrada, comida y salida.
                  </p>
                </div>

                <div className="bg-red-100 text-red-500 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl">
                  
                </div>

              </div>

            </div>
          </Link>

          {/* VENTAS */}

          <Link
            href="/promoter/sales"
            className="group block"
          >
            <div className="bg-white rounded-[28px] border border-neutral-200 shadow-lg p-6 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
              
              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">
                    Ventas
                  </h2>

                  <p className="text-neutral-500 mt-2 text-sm">
                    Captura de tickets y ventas.
                  </p>
                </div>

                <div className="bg-green-100 text-green-600 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl">
                  
                </div>

              </div>

            </div>
          </Link>

          {/* INCIDENCIAS */}

          <Link
            href="/promoter/incidences"
            className="group block"
          >
            <div className="bg-white rounded-[28px] border border-neutral-200 shadow-lg p-6 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
              
              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">
                    Incidencias
                  </h2>

                  <p className="text-neutral-500 mt-2 text-sm">
                    Vacaciones, permisos e incapacidades.
                  </p>
                </div>

                <div className="bg-yellow-100 text-yellow-600 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl">
            
                </div>

              </div>

            </div>
          </Link>

        </div>

      </div>

      <PromoterBottomNav />
    </main>
  );
}