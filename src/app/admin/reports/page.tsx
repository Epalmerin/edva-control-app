"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type LoadingState = false | "excel" | "photos" | "catalogs";

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  brand_name: string | null;
};

type Profile = {
  name: string | null;
  email?: string | null;
};

type AttendanceRow = {
  created_at: string;
  type: string;
  employee_id: string | null;
  profiles: Profile | Profile[] | null;
  stores: Store | Store[] | null;
};

type SaleRow = {
  sale_date: string;
  ticket_number: string | null;
  amount: number | string | null;
  sku: string | null;
  model: string | null;
  employee_id: string | null;
  store_id: string | null;
  profiles: Profile | Profile[] | null;
  stores: Store | Store[] | null;
};

type IncidenceRow = {
  type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  employee_id: string | null;
  profiles: Profile | Profile[] | null;
};

type AccountStoreRow = {
  account_id: string;
  store_id: string;
};

type SalesTargetRow = {
  employee_id: string;
  account_id: string;
  target_amount: number | string | null;
};

type StoreTargetRow = {
  employee_id: string;
  store_id: string;
  target_amount: number | string | null;
};

type AssignmentRow = {
  employee_id: string;
  store_id: string;
};

type SummaryRow = {
  Promotor: string;
  Email: string;
  Cadena: string;
  Tienda: string;
  Venta: number;
  Cuota: number;
  "Cuota cubierta %": number;
  "Pendiente por cubrir": number;
  Estatus: string;
};

async function readAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const rows: T[] = [];

  while (true) {
    const { data, error } = await fetchPage(rows.length, rows.length + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

function singleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function moneyValue(value: number | string | null) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function percentValue(sales: number, target: number) {
  if (target <= 0) return 0;
  return Math.round((sales / target) * 10000) / 100;
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function safeFilePart(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function ReportsPage() {
  const [loading, setLoading] = useState<LoadingState>("catalogs");
  const [message, setMessage] = useState("");
  const [chains, setChains] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState("");

  const [photoStartDate, setPhotoStartDate] = useState("");
  const [photoEndDate, setPhotoEndDate] = useState("");

  const canGenerate = Boolean(selectedChain) && loading !== "excel";

  const selectedChainLabel = useMemo(
    () => selectedChain || "Selecciona una cadena",
    [selectedChain]
  );

  useEffect(() => {
    const loadChains = async () => {
      setLoading("catalogs");

      try {
        const stores = await readAllRows<Store>((from, to) =>
          supabase
            .from("stores")
            .select("id, name, chain_name, brand_name")
            .order("chain_name")
            .order("name")
            .range(from, to)
        );

        const chainNames = Array.from(
          new Set(
            stores
              .map((store) => store.chain_name?.trim())
              .filter((chain): chain is string => Boolean(chain))
          )
        ).sort((a, b) => a.localeCompare(b));

        setChains(chainNames);
        if (!selectedChain && chainNames.length === 1) {
          setSelectedChain(chainNames[0]);
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `Error al cargar cadenas: ${error.message}`
            : "Error al cargar cadenas."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadChains();
  }, [selectedChain]);

  const downloadPhotos = async () => {
    if (!photoStartDate || !photoEndDate) {
      setMessage("Selecciona fecha inicio y fecha fin para exportar fotos.");
      return;
    }

    setLoading("photos");
    setMessage("Preparando ZIP de fotografias...");

    try {
      const response = await fetch(
        `/api/admin/export-photos?startDate=${photoStartDate}&endDate=${photoEndDate}&employeeId=all`
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "No se pudo generar el ZIP.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `fotos-asistencia_${photoStartDate}_${photoEndDate}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage("ZIP de fotografias descargado correctamente.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error al descargar las fotografias."
      );
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (period: "FIRST" | "SECOND") => {
    if (!selectedChain) {
      setMessage("Selecciona una cadena comercial antes de generar el reporte.");
      return;
    }

    setLoading("excel");
    setMessage("");

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const formattedMonth = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const startDate =
      period === "FIRST"
        ? `${year}-${formattedMonth}-01`
        : `${year}-${formattedMonth}-16`;
    const endDate =
      period === "FIRST"
        ? `${year}-${formattedMonth}-15`
        : `${year}-${formattedMonth}-${String(lastDay).padStart(2, "0")}`;

    try {
      const stores = await readAllRows<Store>((from, to) =>
        supabase
          .from("stores")
          .select("id, name, chain_name, brand_name")
          .eq("chain_name", selectedChain)
          .order("name")
          .range(from, to)
      );

      const storeIds = stores.map((store) => store.id);

      if (storeIds.length === 0) {
        setMessage("No hay tiendas configuradas para esa cadena.");
        setLoading(false);
        return;
      }

      const [attendanceData, salesData, accountStores, storeTargets, assignments] =
        await Promise.all([
          readAllRows<AttendanceRow>((from, to) =>
            supabase
              .from("attendance_records")
              .select(
                `
                created_at,
                type,
                employee_id,
                profiles:employee_id (
                  name,
                  email
                ),
                stores:store_id (
                  id,
                  name,
                  chain_name,
                  brand_name
                )
              `
              )
              .in("store_id", storeIds)
              .gte("created_at", `${startDate}T00:00:00`)
              .lte("created_at", `${endDate}T23:59:59`)
              .order("created_at")
              .range(from, to)
          ),
          readAllRows<SaleRow>((from, to) =>
            supabase
              .from("sales_records")
              .select(
                `
                sale_date,
                ticket_number,
                amount,
                sku,
                model,
                employee_id,
                store_id,
                profiles:employee_id (
                  name,
                  email
                ),
                stores:store_id (
                  id,
                  name,
                  chain_name,
                  brand_name
                )
              `
              )
              .in("store_id", storeIds)
              .gte("sale_date", startDate)
              .lte("sale_date", endDate)
              .order("sale_date")
              .range(from, to)
          ),
          readAllRows<AccountStoreRow>((from, to) =>
            supabase
              .from("account_stores")
              .select("account_id, store_id")
              .in("store_id", storeIds)
              .order("account_id")
              .range(from, to)
          ),
          readAllRows<StoreTargetRow>((from, to) =>
            supabase
              .from("sales_store_targets")
              .select("employee_id, store_id, target_amount")
              .in("store_id", storeIds)
              .eq("year", year)
              .eq("month", month)
              .order("employee_id")
              .range(from, to)
          ),
          readAllRows<AssignmentRow>((from, to) =>
            supabase
              .from("employee_store_assignments")
              .select("employee_id, store_id")
              .in("store_id", storeIds)
              .eq("active", true)
              .order("employee_id")
              .range(from, to)
          ),
        ]);

      const accountIds = Array.from(
        new Set(accountStores.map((item) => item.account_id))
      );

      const salesTargets =
        accountIds.length > 0
          ? await readAllRows<SalesTargetRow>((from, to) =>
              supabase
                .from("sales_targets")
                .select("employee_id, account_id, target_amount")
                .in("account_id", accountIds)
                .eq("year", year)
                .eq("month", month)
                .order("employee_id")
                .range(from, to)
            )
          : [];

      const chainEmployeeIds = Array.from(
        new Set([
          ...assignments.map((item) => item.employee_id),
          ...attendanceData
            .map((item) => item.employee_id)
            .filter((id): id is string => Boolean(id)),
          ...salesData
            .map((item) => item.employee_id)
            .filter((id): id is string => Boolean(id)),
          ...salesTargets.map((item) => item.employee_id),
          ...storeTargets.map((item) => item.employee_id),
        ])
      );

      const incidencesData =
        chainEmployeeIds.length > 0
          ? await readAllRows<IncidenceRow>((from, to) =>
              supabase
                .from("incidence_requests")
                .select(
                  `
                  type,
                  status,
                  start_date,
                  end_date,
                  reason,
                  employee_id,
                  profiles:employee_id (
                    name
                  )
                `
                )
                .in("employee_id", chainEmployeeIds)
                .gte("start_date", startDate)
                .lte("start_date", endDate)
                .order("start_date")
                .range(from, to)
            )
          : [];

      const salesByEmployee = new Map<string, number>();
      const employeeInfo = new Map<string, { name: string; email: string }>();
      const storeNameById = new Map(stores.map((store) => [store.id, store.name]));
      const employeeStores = new Map<string, Set<string>>();

      assignments.forEach((assignment) => {
        const storeName = storeNameById.get(assignment.store_id);
        if (!storeName) return;

        const employeeStoreSet =
          employeeStores.get(assignment.employee_id) || new Set<string>();
        employeeStoreSet.add(storeName);
        employeeStores.set(assignment.employee_id, employeeStoreSet);
      });

      salesData.forEach((item) => {
        if (!item.employee_id) return;
        const profile = singleRelation(item.profiles);
        const store = singleRelation(item.stores);
        salesByEmployee.set(
          item.employee_id,
          (salesByEmployee.get(item.employee_id) || 0) + moneyValue(item.amount)
        );
        if (store?.name) {
          const employeeStoreSet =
            employeeStores.get(item.employee_id) || new Set<string>();
          employeeStoreSet.add(store.name);
          employeeStores.set(item.employee_id, employeeStoreSet);
        }
        employeeInfo.set(item.employee_id, {
          name: profile?.name || "Sin nombre",
          email: profile?.email || "",
        });
      });

      attendanceData.forEach((item) => {
        if (!item.employee_id || employeeInfo.has(item.employee_id)) return;
        const profile = singleRelation(item.profiles);
        employeeInfo.set(item.employee_id, {
          name: profile?.name || "Sin nombre",
          email: profile?.email || "",
        });
      });

      const storeTargetsByEmployee = new Map<string, number>();
      storeTargets.forEach((target) => {
        storeTargetsByEmployee.set(
          target.employee_id,
          (storeTargetsByEmployee.get(target.employee_id) || 0) +
            moneyValue(target.target_amount)
        );
      });

      const accountTargetsByEmployee = new Map<string, number>();
      salesTargets.forEach((target) => {
        accountTargetsByEmployee.set(
          target.employee_id,
          (accountTargetsByEmployee.get(target.employee_id) || 0) +
            moneyValue(target.target_amount)
        );
      });

      const summaryEmployeeIds = Array.from(
        new Set([
          ...Array.from(salesByEmployee.keys()),
          ...Array.from(storeTargetsByEmployee.keys()),
          ...Array.from(accountTargetsByEmployee.keys()),
        ])
      );

      const summarySheet: SummaryRow[] = summaryEmployeeIds.map((employeeId) => {
        const sales = salesByEmployee.get(employeeId) || 0;
        const storeTarget = storeTargetsByEmployee.get(employeeId) || 0;
        const accountTarget = accountTargetsByEmployee.get(employeeId) || 0;
        const target = storeTarget > 0 ? storeTarget : accountTarget;
        const pending = Math.max(target - sales, 0);
        const percentage = percentValue(sales, target);
        const info = employeeInfo.get(employeeId);

        return {
          Promotor: info?.name || "Sin nombre",
          Email: info?.email || "",
          Cadena: selectedChain,
          Tienda: Array.from(employeeStores.get(employeeId) || []).join(", "),
          Venta: sales,
          Cuota: target,
          "Cuota cubierta %": percentage,
          "Pendiente por cubrir": pending,
          Estatus:
            target <= 0
              ? "Sin cuota registrada"
              : pending <= 0
                ? "Cuota cubierta"
                : "Pendiente por cubrir",
        };
      });

      const attendanceSheet = attendanceData.map((item) => {
        const profile = singleRelation(item.profiles);
        const store = singleRelation(item.stores);

        return {
          Fecha: item.created_at,
          Tipo: item.type,
          Promotor: profile?.name || "",
          Email: profile?.email || "",
          Tienda: store?.name || "",
          Cadena: store?.chain_name || selectedChain,
          Marca: store?.brand_name || "",
        };
      });

      const salesSheet = salesData.map((item) => {
        const profile = singleRelation(item.profiles);
        const store = singleRelation(item.stores);
        const employeeTarget =
          (item.employee_id && storeTargetsByEmployee.get(item.employee_id)) ||
          (item.employee_id && accountTargetsByEmployee.get(item.employee_id)) ||
          0;
        const employeeSales =
          (item.employee_id && salesByEmployee.get(item.employee_id)) || 0;

        return {
          Fecha: item.sale_date,
          Promotor: profile?.name || "",
          Tienda: store?.name || "",
          Cadena: store?.chain_name || selectedChain,
          Marca: store?.brand_name || "",
          SKU: item.sku || "",
          "Producto/Modelo": item.model || "",
          Ticket: item.ticket_number || "",
          Precio: moneyValue(item.amount),
          "Cuota promotor": employeeTarget,
          "Cuota cubierta %": percentValue(employeeSales, employeeTarget),
          "Pendiente por cubrir": Math.max(employeeTarget - employeeSales, 0),
        };
      });

      const productMap = new Map<
        string,
        {
          sku: string;
          model: string;
          store: string;
          chain: string;
          brand: string;
          units: number;
          total: number;
        }
      >();

      salesData.forEach((item) => {
        const sku = item.sku || "SIN SKU";
        const model = item.model || "SIN MODELO";
        const store = singleRelation(item.stores);
        const storeName = store?.name || "SIN TIENDA";
        const key = `${storeName}|${sku}|${model}`;
        const existing =
          productMap.get(key) || {
            sku,
            model,
            store: storeName,
            chain: store?.chain_name || selectedChain,
            brand: store?.brand_name || "",
            units: 0,
            total: 0,
          };

        existing.units += 1;
        existing.total += moneyValue(item.amount);
        productMap.set(key, existing);
      });

      const productSheet = Array.from(productMap.values()).map((item) => ({
        Tienda: item.store,
        Cadena: item.chain,
        Marca: item.brand,
        SKU: item.sku,
        "Producto/Modelo": item.model,
        "Piezas/Tickets": item.units,
        "Venta total": item.total,
        "Precio promedio": item.units > 0 ? item.total / item.units : 0,
      }));

      const incidencesSheet = incidencesData.map((item) => {
        const profile = singleRelation(item.profiles);

        return {
          Tipo: item.type,
          Estatus: item.status,
          Inicio: item.start_date,
          Fin: item.end_date || "",
          Motivo: item.reason || "",
          Promotor: profile?.name || "",
          Cadena: selectedChain,
        };
      });

      const totals = summarySheet.reduce(
        (acc, row) => {
          acc.sales += row.Venta;
          acc.target += row.Cuota;
          acc.pending += row["Pendiente por cubrir"];
          return acc;
        },
        { sales: 0, target: 0, pending: 0 }
      );

      const totalsSheet = [
        {
          Cadena: selectedChain,
          Periodo: `${startDate} a ${endDate}`,
          Venta: totals.sales,
          Cuota: totals.target,
          "Cuota cubierta %": percentValue(totals.sales, totals.target),
          "Pendiente por cubrir": totals.pending,
          "Asistencias registradas": attendanceSheet.length,
          "Ventas registradas": salesSheet.length,
          Incidencias: incidencesSheet.length,
        },
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(totalsSheet),
        "Resumen"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(summarySheet),
        safeSheetName("Cuota promotores")
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(salesSheet),
        safeSheetName("Ventas detalle")
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(productSheet),
        safeSheetName("Productos")
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(attendanceSheet),
        safeSheetName("Asistencia")
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(incidencesSheet),
        safeSheetName("Incidencias")
      );

      const fileName = `Reporte_EDVA_${safeFilePart(
        selectedChain
      )}_${startDate}_${endDate}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      setMessage(`Reporte generado correctamente: ${fileName}`);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? `Error al generar reporte: ${error.message}`
          : "Error inesperado al generar reporte."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-neutral-800">
          Reportes Quincenales
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Exportacion Excel por cadena comercial con asistencia, ventas,
          productos y avance de cuota.
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mb-8">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Cadena comercial
          </label>
          <select
            value={selectedChain}
            onChange={(event) => {
              setSelectedChain(event.target.value);
              setMessage("");
            }}
            className="w-full border border-neutral-300 rounded-lg px-4 py-3"
            disabled={loading === "catalogs"}
          >
            <option value="">
              {loading === "catalogs"
                ? "Cargando cadenas..."
                : "Selecciona una cadena"}
            </option>
            {chains.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>

          <p className="text-sm text-neutral-500 mt-3">
            El Excel se generara solamente con tiendas de {selectedChainLabel}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-neutral-800">
              Primera Quincena
            </h2>

            <p className="text-neutral-500 mt-2 mb-6">Del dia 1 al 15</p>

            <button
              onClick={() => generateReport("FIRST")}
              disabled={!canGenerate}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
            >
              {loading === "excel" ? "Generando..." : "Generar Excel"}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-neutral-800">
              Segunda Quincena
            </h2>

            <p className="text-neutral-500 mt-2 mb-6">Del dia 16 al cierre</p>

            <button
              onClick={() => generateReport("SECOND")}
              disabled={!canGenerate}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
            >
              {loading === "excel" ? "Generando..." : "Generar Excel"}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-8 max-w-4xl">
          <h2 className="text-2xl font-semibold text-neutral-800">
            Fotografias de asistencia
          </h2>

          <p className="text-neutral-500 mt-2 mb-6">
            Descarga un ZIP con las fotos registradas por rango de fechas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Fecha inicio
              </label>
              <input
                type="date"
                value={photoStartDate}
                onChange={(e) => setPhotoStartDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Fecha fin
              </label>
              <input
                type="date"
                value={photoEndDate}
                onChange={(e) => setPhotoEndDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-4 py-3"
              />
            </div>
          </div>

          <button
            onClick={downloadPhotos}
            disabled={loading === "photos"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
          >
            {loading === "photos" ? "Preparando ZIP..." : "Exportar fotos"}
          </button>
        </div>

        {message && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-5 max-w-4xl">
            <p className="text-neutral-700 font-medium">{message}</p>
          </div>
        )}
      </section>
    </main>
  );
}
