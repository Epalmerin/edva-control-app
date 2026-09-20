"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Promoter = {
  id: string;
  name: string;
  email: string;
};

type SalesTarget = {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  target_amount: number;
};

type AssignedStore = {
  store_id: string;
  name: string;
  chain_name: string | null;
};

type StoreTargetValues = {
  [storeId: string]: string;
};

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function SalesTargetsPage() {
  const today = new Date();

  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [targetAmount, setTargetAmount] = useState("");

  const [assignedStores, setAssignedStores] = useState<AssignedStore[]>([]);
  const [storeTargets, setStoreTargets] = useState<StoreTargetValues>({});
  const [storesLoading, setStoresLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const money = (value: number) =>
    value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  const loadPromoters = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("role", "PROMOTOR")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Error cargando promotores:", error);
      return;
    }

    setPromoters(data || []);
  };

  const loadTargets = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales_targets")
      .select("id, employee_id, year, month, target_amount")
      .eq("year", year)
      .eq("month", month)
      .order("target_amount", { ascending: false });

    if (error) {
      console.error("Error cargando metas:", error);
      setTargets([]);
      setLoading(false);
      return;
    }

    setTargets(data || []);
    setLoading(false);
  };

  const loadPromoterStores = async (promoterId: string) => {
    if (!promoterId) {
      setAssignedStores([]);
      setStoreTargets({});
      return;
    }

    setStoresLoading(true);

    const { data, error } = await supabase
      .from("employee_store_assignments")
      .select(`
        store_id,
        stores:store_id (
          name,
          chain_name
        )
      `)
      .eq("employee_id", promoterId)
      .eq("active", true);

    if (error) {
      console.error("Error cargando tiendas:", error);
      setAssignedStores([]);
      setStoreTargets({});
      setStoresLoading(false);
      return;
    }

    const stores: AssignedStore[] = (data || [])
      .map((item: any) => {
        const store = Array.isArray(item.stores)
          ? item.stores[0]
          : item.stores;

        if (!store) return null;

        return {
          store_id: item.store_id,
          name: store.name,
          chain_name: store.chain_name,
        };
      })
      .filter(Boolean) as AssignedStore[];

    const uniqueStores = Array.from(
      new Map(stores.map((store) => [store.store_id, store])).values()
    );

    setAssignedStores(uniqueStores);

    const { data: storeTargetData, error: storeTargetError } = await supabase
      .from("sales_store_targets")
      .select("store_id, target_amount")
      .eq("employee_id", promoterId)
      .eq("year", year)
      .eq("month", month);

    if (storeTargetError) {
      console.error("Error cargando metas por tienda:", storeTargetError);
      setStoreTargets({});
      setStoresLoading(false);
      return;
    }

    const values: StoreTargetValues = {};

    (storeTargetData || []).forEach((item: any) => {
      values[item.store_id] = String(item.target_amount);
    });

    setStoreTargets(values);
    setStoresLoading(false);
  };

  useEffect(() => {
    loadPromoters();
  }, []);

  useEffect(() => {
    loadTargets();
  }, [month, year]);

  useEffect(() => {
    if (employeeId) {
      loadPromoterStores(employeeId);
    } else {
      setAssignedStores([]);
      setStoreTargets({});
    }
  }, [employeeId, month, year]);

  const promoterMap = useMemo(() => {
    const map = new Map<string, Promoter>();

    promoters.forEach((promoter) => {
      map.set(promoter.id, promoter);
    });

    return map;
  }, [promoters]);

  const numericTarget = Number(targetAmount.replace(/,/g, "")) || 0;

  const distributedTotal = useMemo(() => {
    return assignedStores.reduce((total, store) => {
      const value =
        Number((storeTargets[store.store_id] || "").replace(/,/g, "")) || 0;

      return total + value;
    }, 0);
  }, [assignedStores, storeTargets]);

  const remainingToDistribute = Math.max(
    numericTarget - distributedTotal,
    0
  );

  const distributionExceeded =
    numericTarget > 0 && distributedTotal > numericTarget;

  const distributionComplete =
    assignedStores.length > 1 &&
    numericTarget > 0 &&
    distributedTotal === numericTarget;

  const saveTarget = async () => {
    setMessage("");

    if (!employeeId) {
      setMessageType("error");
      setMessage("Selecciona un promotor.");
      return;
    }

    const amount = Number(targetAmount.replace(/,/g, ""));

    if (!amount || amount <= 0) {
      setMessageType("error");
      setMessage("Ingresa una meta válida.");
      return;
    }

    if (assignedStores.length > 1) {
      const hasEmptyStore = assignedStores.some((store) => {
        const value =
          Number((storeTargets[store.store_id] || "").replace(/,/g, "")) || 0;

        return value <= 0;
      });

      if (hasEmptyStore) {
        setMessageType("error");
        setMessage("Asigna una meta a cada tienda del promotor.");
        return;
      }

      if (distributedTotal !== amount) {
        setMessageType("error");
        setMessage(
          "La distribución por tiendas debe ser igual a la meta total."
        );
        return;
      }
    }

    setSaving(true);

    const { error } = await supabase.from("sales_targets").upsert(
      {
        employee_id: employeeId,
        year,
        month,
        target_amount: amount,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "employee_id,year,month",
      }
    );

    if (error) {
      console.error("Error guardando meta:", error);
      setMessageType("error");
      setMessage("No fue posible guardar la meta.");
      setSaving(false);
      return;
    }

    if (assignedStores.length > 1) {
      const storeRows = assignedStores.map((store) => ({
        employee_id: employeeId,
        store_id: store.store_id,
        year,
        month,
        target_amount:
          Number((storeTargets[store.store_id] || "").replace(/,/g, "")) || 0,
        updated_at: new Date().toISOString(),
      }));

      const { error: storeError } = await supabase
        .from("sales_store_targets")
        .upsert(storeRows, {
          onConflict: "employee_id,store_id,year,month",
        });

      if (storeError) {
        console.error("Error guardando metas por tienda:", storeError);
        setMessageType("error");
        setMessage(
          "La meta general se guardó, pero hubo un problema con la distribución por tienda."
        );
        setSaving(false);
        await loadTargets();
        return;
      }
    }

    setMessageType("success");
    setMessage("Meta guardada correctamente.");

    await loadTargets();
    await loadPromoterStores(employeeId);

    setSaving(false);
  };

  const editTarget = (target: SalesTarget) => {
    setEmployeeId(target.employee_id);
    setTargetAmount(String(target.target_amount));
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleStoreTargetChange = (storeId: string, value: string) => {
    setStoreTargets((current) => ({
      ...current,
      [storeId]: value,
    }));
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-800">
            Metas de venta
          </h1>

          <p className="text-neutral-500 mt-2">
            Asigna y administra los objetivos mensuales de los promotores.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* FORMULARIO */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-xl font-bold text-neutral-900">
                Asignar meta mensual
              </h2>

              <p className="text-sm text-neutral-500 mt-1 mb-6">
                Selecciona el promotor y define su objetivo de venta.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Promotor
                  </label>

                  <select
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                      setTargetAmount("");
                      setMessage("");
                    }}
                    className="w-full border border-neutral-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">Seleccionar promotor</option>

                    {promoters.map((promoter) => (
                      <option key={promoter.id} value={promoter.id}>
                        {promoter.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Mes
                    </label>

                    <select
                      value={month}
                      onChange={(e) => {
                        setMonth(Number(e.target.value));
                        setTargetAmount("");
                        setMessage("");
                      }}
                      className="w-full border border-neutral-300 rounded-xl px-4 py-3 bg-white outline-none"
                    >
                      {months.map((monthName, index) => (
                        <option key={monthName} value={index + 1}>
                          {monthName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Año
                    </label>

                    <select
                      value={year}
                      onChange={(e) => {
                        setYear(Number(e.target.value));
                        setTargetAmount("");
                        setMessage("");
                      }}
                      className="w-full border border-neutral-300 rounded-xl px-4 py-3 bg-white outline-none"
                    >
                      {[2025, 2026, 2027, 2028].map((yearOption) => (
                        <option key={yearOption} value={yearOption}>
                          {yearOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Meta total de venta
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">
                      $
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="300000"
                      className="w-full border border-neutral-300 rounded-xl pl-8 pr-4 py-3 outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                {/* DISTRIBUCIÓN POR TIENDA */}
                {employeeId && storesLoading && (
                  <div className="border-t border-neutral-200 pt-5">
                    <p className="text-sm text-neutral-500">
                      Cargando tiendas asignadas...
                    </p>
                  </div>
                )}

                {employeeId &&
                  !storesLoading &&
                  assignedStores.length === 0 && (
                    <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-yellow-800">
                        Este promotor no tiene tiendas activas asignadas.
                      </p>
                    </div>
                  )}

                {employeeId &&
                  !storesLoading &&
                  assignedStores.length === 1 && (
                    <div className="border-t border-neutral-200 pt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Tienda asignada
                      </p>

                      <p className="font-bold text-neutral-900 mt-2">
                        {assignedStores[0].name}
                      </p>

                      {assignedStores[0].chain_name && (
                        <p className="text-sm text-neutral-500 mt-1">
                          {assignedStores[0].chain_name}
                        </p>
                      )}
                    </div>
                  )}

                {employeeId &&
                  !storesLoading &&
                  assignedStores.length > 1 && (
                    <div className="border-t border-neutral-200 pt-5">
                      <div className="mb-4">
                        <h3 className="font-bold text-neutral-900">
                          Distribución por tienda
                        </h3>

                        <p className="text-sm text-neutral-500 mt-1">
                          Este promotor tiene {assignedStores.length} tiendas
                          asignadas.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {assignedStores.map((store) => (
                          <div
                            key={store.store_id}
                            className="border border-neutral-200 rounded-xl p-4"
                          >
                            <p className="font-bold text-neutral-900">
                              {store.name}
                            </p>

                            {store.chain_name && (
                              <p className="text-xs text-neutral-500 mt-1">
                                {store.chain_name}
                              </p>
                            )}

                            <div className="relative mt-3">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">
                                $
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={storeTargets[store.store_id] || ""}
                                onChange={(e) =>
                                  handleStoreTargetChange(
                                    store.store_id,
                                    e.target.value
                                  )
                                }
                                placeholder="0"
                                className="w-full border border-neutral-300 rounded-xl pl-8 pr-4 py-3 outline-none focus:ring-2 focus:ring-neutral-900"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-neutral-100 rounded-xl p-4 mt-4 space-y-2">
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-neutral-500">Meta total</span>
                          <span className="font-bold text-neutral-900">
                            {money(numericTarget)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-neutral-500">Distribuido</span>
                          <span
                            className={`font-bold ${
                              distributionExceeded
                                ? "text-red-600"
                                : "text-neutral-900"
                            }`}
                          >
                            {money(distributedTotal)}
                          </span>
                        </div>

                        <div className="border-t border-neutral-200 pt-2 flex justify-between gap-4 text-sm">
                          <span className="font-semibold text-neutral-700">
                            Pendiente
                          </span>

                          <span
                            className={`font-black ${
                              distributionComplete
                                ? "text-green-600"
                                : distributionExceeded
                                ? "text-red-600"
                                : "text-neutral-900"
                            }`}
                          >
                            {distributionExceeded
                              ? `Excede ${money(
                                  distributedTotal - numericTarget
                                )}`
                              : money(remainingToDistribute)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                <button
                  onClick={saveTarget}
                  disabled={saving}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white py-3 rounded-xl font-bold transition"
                >
                  {saving ? "Guardando..." : "Guardar meta"}
                </button>

                {message && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      messageType === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* METAS DEL MES */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-xl font-bold text-neutral-900">
                  {months[month - 1]} {year}
                </h2>

                <p className="text-sm text-neutral-500 mt-1">
                  {targets.length} meta(s) asignada(s)
                </p>
              </div>

              {loading ? (
                <div className="p-8 text-center text-neutral-500">
                  Cargando metas...
                </div>
              ) : targets.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-semibold text-neutral-700">
                    No hay metas asignadas para este periodo.
                  </p>

                  <p className="text-sm text-neutral-500 mt-2">
                    Utiliza el formulario para asignar la primera meta.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {targets.map((target) => {
                    const promoter = promoterMap.get(target.employee_id);

                    return (
                      <div
                        key={target.id}
                        className="p-5 flex items-center justify-between gap-4 hover:bg-neutral-50"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900">
                            {promoter?.name || "Promotor"}
                          </p>

                          <p className="text-sm text-neutral-500 mt-1">
                            {promoter?.email || ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          <p className="text-lg font-black text-red-500 whitespace-nowrap">
                            {money(Number(target.target_amount))}
                          </p>

                          <button
                            onClick={() => editTarget(target)}
                            className="border border-neutral-300 hover:bg-neutral-100 px-4 py-2 rounded-lg text-sm font-semibold text-neutral-700"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}