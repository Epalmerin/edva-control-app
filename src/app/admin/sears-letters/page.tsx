"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type EmployeeOption = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type EmployeeProfile = {
  id: string;
  name: string | null;
  first_name: string | null;
  paternal_last_name: string | null;
  maternal_last_name: string | null;
  nss: string | null;
  work_days: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
};

type StoreAssignment = {
  stores:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type FormState = {
  employeeId: string;
  date: string;
  storeName: string;
  validityStartDate: string;
  validityEndDate: string;
  workDays: string;
  workSchedule: string;
  imei: string;
  phoneBrand: string;
  phoneColor: string;
};

const initialForm: FormState = {
  employeeId: "",
  date: "",
  storeName: "",
  validityStartDate: "",
  validityEndDate: "",
  workDays: "",
  workSchedule: "",
  imei: "",
  phoneBrand: "",
  phoneColor: "",
};

const relation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value;

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "");

export default function SearsLettersPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeProfile | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const employeeDisplayName = useMemo(() => {
    if (!selectedEmployee) return "";

    return [
      selectedEmployee.paternal_last_name,
      selectedEmployee.maternal_last_name,
      selectedEmployee.first_name,
    ]
      .filter(Boolean)
      .join(" ") || selectedEmployee.name || "";
  }, [selectedEmployee]);

  useEffect(() => {
    const loadEmployees = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .eq("active", true)
        .order("name");

      if (error) {
        setMessageType("error");
        setMessage("No fue posible cargar empleados.");
        return;
      }

      setEmployees(data || []);
    };

    loadEmployees();
  }, []);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleEmployeeChange = async (employeeId: string) => {
    setMessage("");
    setSelectedEmployee(null);
    setForm((current) => ({ ...current, employeeId }));

    if (!employeeId) return;

    setLoadingEmployee(true);

    const [{ data: profile, error }, { data: assignments }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, name, first_name, paternal_last_name, maternal_last_name, nss, work_days, work_start_time, work_end_time"
        )
        .eq("id", employeeId)
        .single<EmployeeProfile>(),
      supabase
        .from("employee_store_assignments")
        .select(
          `
          stores:store_id (
            name
          )
        `
        )
        .eq("employee_id", employeeId)
        .eq("active", true)
        .returns<StoreAssignment[]>(),
    ]);

    if (error || !profile) {
      setMessageType("error");
      setMessage("No fue posible cargar los datos del empleado.");
      setLoadingEmployee(false);
      return;
    }

    const firstStore = relation(assignments?.[0]?.stores || null);
    const start = formatTime(profile.work_start_time);
    const end = formatTime(profile.work_end_time);

    setSelectedEmployee(profile);
    setForm((current) => ({
      ...current,
      employeeId,
      storeName: current.storeName || firstStore?.name || "",
      workDays: current.workDays || profile.work_days || "",
      workSchedule: current.workSchedule || (start && end ? `de ${start} a ${end}` : ""),
    }));
    setLoadingEmployee(false);
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setGenerating(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setMessageType("error");
      setMessage("Tu sesion expiro. Inicia sesion nuevamente.");
      setGenerating(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/generate-sears-letters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "No fue posible generar las cartas.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName =
        response.headers
          .get("content-disposition")
          ?.match(/filename="(.+)"/)?.[1] || "Cartas_Sears.zip";

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessageType("success");
      setMessage("Cartas Sears generadas correctamente.");
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Error inesperado al generar cartas."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="max-w-6xl">
          <h1 className="text-4xl font-bold text-neutral-800">Cartas Sears</h1>
          <p className="text-neutral-500 mt-2 mb-8">
            Genera carta de ingreso, carta de celular y nuevo formato en un solo archivo.
          </p>

          <form onSubmit={handleGenerate} className="space-y-6">
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-5">
                Empleado
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    Selecciona empleado
                  </label>
                  <select
                    className="w-full mt-1 px-4 py-3 border rounded-lg"
                    value={form.employeeId}
                    onChange={(event) => handleEmployeeChange(event.target.value)}
                    required
                    disabled={loadingEmployee}
                  >
                    <option value="">Selecciona empleado</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.email || employee.role}
                      </option>
                    ))}
                  </select>
                </div>

                <ReadOnlyField
                  label="Nombre para cartas"
                  value={employeeDisplayName || "Se llenara al seleccionar empleado"}
                />
              </div>
            </section>

            <FormSection title="Datos generales">
              <TextInput
                label="Fecha de carta"
                type="date"
                value={form.date}
                onChange={(value) => updateField("date", value)}
                required
              />
              <TextInput
                label="Tienda"
                value={form.storeName}
                onChange={(value) => updateField("storeName", value)}
                placeholder="Ej. SEARS SANTA FE"
                required
              />
              <TextInput
                label="Inicio de vigencia"
                type="date"
                value={form.validityStartDate}
                onChange={(value) => updateField("validityStartDate", value)}
                required
              />
              <TextInput
                label="Termino de vigencia"
                type="date"
                value={form.validityEndDate}
                onChange={(value) => updateField("validityEndDate", value)}
                required
              />
              <TextInput
                label="Dias de trabajo"
                value={form.workDays}
                onChange={(value) => updateField("workDays", value)}
                placeholder="Ej. de jueves a martes"
                required
              />
              <TextInput
                label="Horario"
                value={form.workSchedule}
                onChange={(value) => updateField("workSchedule", value)}
                placeholder="Ej. de 11:00 a.m. a 19:00 p.m."
                required
              />
            </FormSection>

            <FormSection title="Carta de celular">
              <TextInput
                label="IMEI"
                value={form.imei}
                onChange={(value) => updateField("imei", value)}
                placeholder="Ej. 862070073555922/32"
                required
              />
              <TextInput
                label="Marca"
                value={form.phoneBrand}
                onChange={(value) => updateField("phoneBrand", value)}
                placeholder="Ej. GALAXY S24 ULTRA"
                required
              />
              <TextInput
                label="Color"
                value={form.phoneColor}
                onChange={(value) => updateField("phoneColor", value)}
                placeholder="Ej. GRIS"
                required
              />
            </FormSection>

            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-neutral-500">Salida</p>
                <p className="font-semibold text-neutral-800">
                  Se descargara un ZIP con las 3 cartas en Word.
                </p>
              </div>

              <button
                type="submit"
                disabled={generating || loadingEmployee}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-60"
              >
                {generating ? "Generando cartas..." : "Generar 3 cartas"}
              </button>
            </div>
          </form>

          {message && (
            <div
              className={`mt-5 rounded-lg p-4 text-sm font-medium ${
                messageType === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-neutral-800 mb-5">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {children}
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <input
        type={type}
        className="w-full mt-1 px-4 py-3 border rounded-lg placeholder:text-neutral-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="w-full mt-1 px-4 py-3 border rounded-lg bg-neutral-50 text-neutral-700">
        {value}
      </div>
    </div>
  );
}
