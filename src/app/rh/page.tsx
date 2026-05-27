"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Assignment = {
  employee_id: string;

  profiles: {
    name: string;
    email: string;
  } | null;

  stores: {
    name: string;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type AttendanceRecord = {
  employee_id: string;
  type: string;

  profiles: {
    name: string;
  } | null;
};

type PendingEmployee = {
  name: string;
  store: string;
  chain: string;
};

type ChainSummary = {
  chain: string;
  total: number;
  reported: number;
  pending: PendingEmployee[];
};

export default function RHPage() {
  const [loading, setLoading] = useState(true);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const loadData = async () => {
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [assignmentsResponse, attendanceResponse] =
      await Promise.all([
        supabase
          .from("employee_store_assignments")
          .select(`
            employee_id,

            profiles:employee_id (
              name,
              email
            ),

            stores:store_id (
              name,
              chain_name,
              brand_name
            )
          `)
          .eq("active", true),

        supabase
          .from("attendance_records")
          .select(`
            employee_id,
            type,

            profiles:employee_id (
              name
            )
          `)
          .eq("type", "ENTRY")
          .gte("created_at", today.toISOString()),
      ]);

    if (assignmentsResponse.error) {
      console.error(assignmentsResponse.error);
    }

    if (attendanceResponse.error) {
      console.error(attendanceResponse.error);
    }

    setAssignments(
      (assignmentsResponse.data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,

        stores: Array.isArray(item.stores)
          ? item.stores[0]
          : item.stores,
      }))
    );

    setAttendance(
      (attendanceResponse.data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const reportedEmployees = useMemo(() => {
    return new Set(attendance.map((a) => a.employee_id));
  }, [attendance]);

  const chainSummaries = useMemo<ChainSummary[]>(() => {
    const map = new Map<string, ChainSummary>();

    assignments.forEach((assignment) => {
      const chain =
        assignment.stores?.chain_name || "Sin cadena";

      if (!map.has(chain)) {
        map.set(chain, {
          chain,
          total: 0,
          reported: 0,
          pending: [],
        });
      }

      const item = map.get(chain)!;

      item.total += 1;

      const hasReported = reportedEmployees.has(
        assignment.employee_id
      );

      if (hasReported) {
        item.reported += 1;
      } else {
        item.pending.push({
          name:
            assignment.profiles?.name ||
            "Sin nombre",

          store:
            assignment.stores?.name ||
            "Sin tienda",

          chain,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const pendingA = a.total - a.reported;
      const pendingB = b.total - b.reported;

      return pendingB - pendingA;
    });
  }, [assignments, reportedEmployees]);

  const totalEmployees = assignments.length;

  const totalReported = attendance.length;

  const totalPending =
    totalEmployees - totalReported;

  const coverage =
    totalEmployees > 0
      ? Math.round(
          (totalReported / totalEmployees) * 100
        )
      : 0;

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="RH EDVA" />

      <section className="flex-1 p-8">

        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-800">
              Panel RH
            </h1>

            <p className="text-neutral-500 mt-2">
              Monitoreo operativo y control diario.
            </p>
          </div>

          <button
            onClick={loadData}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">
              Plantilla activa
            </p>

            <p className="text-4xl font-black text-red-500 mt-3">
              {totalEmployees}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">
              Reportaron entrada
            </p>

            <p className="text-4xl font-black text-green-500 mt-3">
              {totalReported}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">
              Pendientes
            </p>

            <p className="text-4xl font-black text-red-500 mt-3">
              {totalPending}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-neutral-500 text-sm">
              Cobertura
            </p>

            <p className="text-4xl font-black text-blue-500 mt-3">
              {coverage}%
            </p>
          </div>

        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-800">
                Pendientes por cadena
              </h2>

              <p className="text-sm text-neutral-500 mt-1">
                Promotores que aún no reportan entrada hoy.
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-neutral-500">
              Cargando información...
            </p>
          )}

          <div className="space-y-6">

            {chainSummaries.map((chain) => {
              const pendingCount =
                chain.total - chain.reported;

              const chainCoverage =
                chain.total > 0
                  ? Math.round(
                      (chain.reported / chain.total) * 100
                    )
                  : 0;

              return (
                <div
                  key={chain.chain}
                  className="border rounded-2xl overflow-hidden"
                >

                  <div className="bg-neutral-900 text-white px-5 py-4">

                    <div className="flex justify-between items-center gap-4">

                      <div>
                        <h3 className="font-bold text-lg">
                          {chain.chain}
                        </h3>

                        <p className="text-sm text-neutral-300 mt-1">
                          {chain.reported} presentes ·{" "}
                          {pendingCount} pendientes ·{" "}
                          {chain.total} asignados
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-black">
                          {chainCoverage}%
                        </p>
                      </div>

                    </div>

                  </div>

                  <div className="p-5 bg-neutral-50">

                    {chain.pending.length === 0 ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="font-semibold text-green-700">
                          ✅ Todos reportaron entrada.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">

                        {chain.pending.map((employee, index) => (
                          <div
                            key={`${employee.name}-${index}`}
                            className="bg-white border border-red-200 rounded-xl p-4 flex justify-between items-center gap-4"
                          >

                            <div>
                              <p className="font-bold text-neutral-800">
                                {employee.name}
                              </p>

                              <p className="text-sm text-neutral-500">
                                {employee.store}
                              </p>
                            </div>

                            <div>
                              <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-bold">
                                Pendiente
                              </span>
                            </div>

                          </div>
                        ))}

                      </div>
                    )}

                  </div>

                </div>
              );
            })}

          </div>

        </div>

      </section>
    </main>
  );
}