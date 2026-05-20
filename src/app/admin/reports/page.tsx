"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const generateReport = async (period: "FIRST" | "SECOND") => {
    setLoading(true);
    setMessage("");

    const now = new Date();

    let startDate = "";
    let endDate = "";

    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const formattedMonth = String(month).padStart(2, "0");

    if (period === "FIRST") {
      startDate = `${year}-${formattedMonth}-01`;
      endDate = `${year}-${formattedMonth}-15`;
    } else {
      startDate = `${year}-${formattedMonth}-16`;

      const lastDay = new Date(year, month, 0).getDate();

      endDate = `${year}-${formattedMonth}-${lastDay}`;
    }

    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance_records")
      .select(`
        created_at,
        type,
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
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`);

    if (attendanceError) {
      setMessage(`Error asistencia: ${attendanceError.message}`);
      setLoading(false);
      return;
    }

    const { data: salesData, error: salesError } = await supabase
      .from("sales_records")
      .select(`
        sale_date,
        ticket_number,
        amount,
        sku,
        model,
        profiles:employee_id (
          name
        ),
        stores:store_id (
          name,
          chain_name,
          brand_name
        )
      `)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    if (salesError) {
      setMessage(`Error ventas: ${salesError.message}`);
      setLoading(false);
      return;
    }

    const { data: incidencesData, error: incidencesError } = await supabase
      .from("incidence_requests")
      .select(`
        type,
        status,
        start_date,
        end_date,
        reason,
        profiles:employee_id (
          name
        )
      `)
      .gte("start_date", startDate)
      .lte("start_date", endDate);

    if (incidencesError) {
      setMessage(`Error incidencias: ${incidencesError.message}`);
      setLoading(false);
      return;
    }

    const attendanceSheet = (attendanceData || []).map((item: any) => ({
      Fecha: item.created_at,
      Tipo: item.type,
      Promotor: Array.isArray(item.profiles)
        ? item.profiles[0]?.name
        : item.profiles?.name,
      Tienda: Array.isArray(item.stores)
        ? item.stores[0]?.name
        : item.stores?.name,
      Cadena: Array.isArray(item.stores)
        ? item.stores[0]?.chain_name
        : item.stores?.chain_name,
      Marca: Array.isArray(item.stores)
        ? item.stores[0]?.brand_name
        : item.stores?.brand_name,
    }));

    const salesSheet = (salesData || []).map((item: any) => ({
      Fecha: item.sale_date,
      Promotor: Array.isArray(item.profiles)
        ? item.profiles[0]?.name
        : item.profiles?.name,
      Tienda: Array.isArray(item.stores)
        ? item.stores[0]?.name
        : item.stores?.name,
      Cadena: Array.isArray(item.stores)
        ? item.stores[0]?.chain_name
        : item.stores?.chain_name,
      Marca: Array.isArray(item.stores)
        ? item.stores[0]?.brand_name
        : item.stores?.brand_name,
      SKU: item.sku,
      Modelo: item.model,
      Ticket: item.ticket_number,
      Monto: item.amount,
    }));

    const incidencesSheet = (incidencesData || []).map((item: any) => ({
      Tipo: item.type,
      Estatus: item.status,
      Inicio: item.start_date,
      Fin: item.end_date,
      Motivo: item.reason,
      Promotor: Array.isArray(item.profiles)
        ? item.profiles[0]?.name
        : item.profiles?.name,
    }));

    const workbook = XLSX.utils.book_new();

    const attendanceWorksheet =
      XLSX.utils.json_to_sheet(attendanceSheet);

    const salesWorksheet =
      XLSX.utils.json_to_sheet(salesSheet);

    const incidencesWorksheet =
      XLSX.utils.json_to_sheet(incidencesSheet);

    XLSX.utils.book_append_sheet(
      workbook,
      attendanceWorksheet,
      "Asistencia"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      salesWorksheet,
      "Ventas"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      incidencesWorksheet,
      "Incidencias"
    );

    const fileName = `Reporte_EDVA_${startDate}_${endDate}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    setMessage(`Reporte generado correctamente: ${fileName}`);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-neutral-800">
          Reportes Quincenales
        </h1>

        <p className="text-neutral-500 mt-2 mb-8">
          Exportación Excel de asistencia, ventas e incidencias.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-2xl font-semibold text-neutral-800">
              Primera Quincena
            </h2>

            <p className="text-neutral-500 mt-2 mb-6">
              Del día 1 al 15
            </p>

            <button
              onClick={() => generateReport("FIRST")}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {loading ? "Generando..." : "Generar Excel"}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-2xl font-semibold text-neutral-800">
              Segunda Quincena
            </h2>

            <p className="text-neutral-500 mt-2 mb-6">
              Del día 16 al 30/31
            </p>

            <button
              onClick={() => generateReport("SECOND")}
              disabled={loading}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {loading ? "Generando..." : "Generar Excel"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-8 bg-white rounded-2xl shadow-md p-5 max-w-4xl">
            <p className="text-neutral-700 font-medium">
              {message}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}