"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Account = {
  id: string;
  name: string;
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  chain_name: string | null;
  brand_name: string | null;
};

type AccountStoreRow = {
  account_id: string;
  stores: Store | Store[] | null;
};

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
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  sex: string | null;
  marital_status: string | null;
  curp: string | null;
  rfc: string | null;
  fiscal_postal_code: string | null;
  nss: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  municipality: string | null;
  state: string | null;
  hire_date: string | null;
  role: string | null;
  contract_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  salary: number | string | null;
  salary_period: string | null;
  pay_frequency: string | null;
  has_infonavit_credit: boolean | null;
  bank_name: string | null;
  bank_clabe: string | null;
  weekly_hours: number | string | null;
  work_days: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
};

type EmployeeStoreAssignmentRow = {
  store_id: string;
};

type AccountStorePair = {
  account_id: string;
  store_id: string;
};

type FormState = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  sex: string;
  maritalStatus: string;
  curp: string;
  rfc: string;
  fiscalPostalCode: string;
  nss: string;
  phone: string;
  email: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  municipality: string;
  state: string;
  hireDate: string;
  role: string;
  contractType: string;
  contractStartDate: string;
  contractEndDate: string;
  salary: string;
  salaryPeriod: string;
  payFrequency: string;
  hasInfonavitCredit: string;
  bankName: string;
  bankClabe: string;
  weeklyHours: string;
  workDays: string;
  workStartTime: string;
  breakStartTime: string;
  breakEndTime: string;
  workEndTime: string;
  password: string;
};

type SelectedAccountStores = Record<string, string[]>;

const initialForm: FormState = {
  firstName: "",
  paternalLastName: "",
  maternalLastName: "",
  birthDate: "",
  birthPlace: "",
  nationality: "",
  sex: "",
  maritalStatus: "",
  curp: "",
  rfc: "",
  fiscalPostalCode: "",
  nss: "",
  phone: "",
  email: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  postalCode: "",
  municipality: "",
  state: "",
  hireDate: "",
  role: "",
  contractType: "",
  contractStartDate: "",
  contractEndDate: "",
  salary: "",
  salaryPeriod: "",
  payFrequency: "",
  hasInfonavitCredit: "",
  bankName: "",
  bankClabe: "",
  weeklyHours: "",
  workDays: "",
  workStartTime: "",
  breakStartTime: "",
  breakEndTime: "",
  workEndTime: "",
  password: "",
};

const roles = [
  { value: "PROMOTOR", label: "Promotor" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "SUPERVISOR_VILLARREAL", label: "Supervisor Villarreal" },
  { value: "RH", label: "Recursos Humanos" },
  { value: "ADMIN", label: "Administrador" },
];

const maritalStatuses = [
  { value: "SINGLE_MALE", label: "SOLTERO" },
  { value: "SINGLE_FEMALE", label: "SOLTERA" },
  { value: "MARRIED_MALE", label: "CASADO" },
  { value: "MARRIED_FEMALE", label: "CASADA" },
  { value: "DIVORCED_MALE", label: "DIVORCIADO" },
  { value: "DIVORCED_FEMALE", label: "DIVORCIADA" },
  { value: "WIDOWED_MALE", label: "VIUDO" },
  { value: "WIDOWED_FEMALE", label: "VIUDA" },
  { value: "COMMON_LAW", label: "UNION LIBRE" },
  { value: "OTHER", label: "OTRO" },
];

const sexOptions = [
  { value: "FEMALE", label: "FEMENINO" },
  { value: "MALE", label: "MASCULINO" },
  { value: "OTHER", label: "OTRO" },
];

const contractTypes = [
  { value: "INDEFINITE", label: "Indefinido" },
  { value: "FIXED_TERM", label: "Tiempo determinado" },
  { value: "TRIAL", label: "Periodo de prueba" },
  { value: "TEMPORARY", label: "Temporal" },
];

const payFrequencies = [
  { value: "DAILY", label: "Diario" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
];

const salaryPeriods = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "DAILY", label: "Diario" },
];

const yesNoOptions = [
  { value: "YES", label: "SI" },
  { value: "NO", label: "NO" },
];

export default function EmployeesPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [storesByAccount, setStoresByAccount] = useState<Record<string, Store[]>>(
    {}
  );
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<SelectedAccountStores>({});
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [contractEmployeeId, setContractEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const isPromoter = form.role === "PROMOTOR";
  const isEditMode = Boolean(editEmployeeId);

  const fullName = useMemo(() => {
    return [
      form.firstName.trim(),
      form.paternalLastName.trim(),
      form.maternalLastName.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }, [form.firstName, form.paternalLastName, form.maternalLastName]);

  const loadEmployeeOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Error cargando empleados:", error);
      return;
    }

    setEmployeeOptions(data || []);
  }, []);

  const fillFormFromProfile = (profile: EmployeeProfile) => {
    setForm({
      firstName: profile.first_name || profile.name || "",
      paternalLastName: profile.paternal_last_name || "",
      maternalLastName: profile.maternal_last_name || "",
      birthDate: profile.birth_date || "",
      birthPlace: profile.birth_place || "",
      nationality: profile.nationality || "",
      sex: profile.sex || "",
      maritalStatus: profile.marital_status || "",
      curp: profile.curp || "",
      rfc: profile.rfc || "",
      fiscalPostalCode: profile.fiscal_postal_code || "",
      nss: profile.nss || "",
      phone: profile.phone || "",
      email: profile.email || "",
      street: profile.street || "",
      exteriorNumber: profile.exterior_number || "",
      interiorNumber: profile.interior_number || "",
      neighborhood: profile.neighborhood || "",
      postalCode: profile.postal_code || "",
      municipality: profile.municipality || "",
      state: profile.state || "",
      hireDate: profile.hire_date || "",
      role: profile.role || "",
      contractType: profile.contract_type || "",
      contractStartDate: profile.contract_start_date || "",
      contractEndDate: profile.contract_end_date || "",
      salary: profile.salary === null ? "" : String(profile.salary),
      salaryPeriod: profile.salary_period || "",
      payFrequency: profile.pay_frequency || "",
      hasInfonavitCredit:
        profile.has_infonavit_credit === null
          ? ""
          : profile.has_infonavit_credit
            ? "YES"
            : "NO",
      bankName: profile.bank_name || "",
      bankClabe: profile.bank_clabe || "",
      weeklyHours: profile.weekly_hours === null ? "" : String(profile.weekly_hours),
      workDays: profile.work_days || "",
      workStartTime: profile.work_start_time?.slice(0, 5) || "",
      breakStartTime: profile.break_start_time?.slice(0, 5) || "",
      breakEndTime: profile.break_end_time?.slice(0, 5) || "",
      workEndTime: profile.work_end_time?.slice(0, 5) || "",
      password: "",
    });
  };

  const loadEmployeeForEdit = async (employeeId: string) => {
    setEditEmployeeId(employeeId);
    setMessage("");

    if (!employeeId) {
      resetForm();
      return;
    }

    setEditLoading(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", employeeId)
      .single<EmployeeProfile>();

    if (profileError || !profile) {
      setMessageType("error");
      setMessage("No fue posible cargar el expediente del empleado.");
      setEditLoading(false);
      return;
    }

    const { data: assignments } = await supabase
      .from("employee_store_assignments")
      .select("store_id")
      .eq("employee_id", employeeId)
      .eq("active", true)
      .returns<EmployeeStoreAssignmentRow[]>();

    const storeIds = assignments?.map((assignment) => assignment.store_id) || [];
    const nextSelectedStores: SelectedAccountStores = {};

    if (storeIds.length > 0) {
      const { data: accountStores } = await supabase
        .from("account_stores")
        .select("account_id, store_id")
        .in("store_id", storeIds)
        .returns<AccountStorePair[]>();

      (accountStores || []).forEach((pair) => {
        nextSelectedStores[pair.account_id] =
          nextSelectedStores[pair.account_id] || [];
        nextSelectedStores[pair.account_id].push(pair.store_id);
      });
    }

    fillFormFromProfile(profile);
    setSelectedAccounts(Object.keys(nextSelectedStores));
    setSelectedStores(nextSelectedStores);
    setEditLoading(false);
  };

  useEffect(() => {
    const loadOperationCatalogs = async () => {
      setCatalogsLoading(true);

      const [{ data: accountData, error: accountError }, { data, error }] =
        await Promise.all([
          supabase
            .from("accounts")
            .select("id, name")
            .eq("active", true)
            .order("name"),
          supabase
            .from("account_stores")
            .select(
              `
              account_id,
              stores:store_id (
                id,
                name,
                address,
                chain_name,
                brand_name
              )
            `
            ),
        ]);

      if (accountError || error) {
        console.error("Error cargando catalogos operativos:", {
          accountError,
          error,
        });
        setMessageType("error");
        setMessage("No fue posible cargar cuentas y tiendas.");
        setCatalogsLoading(false);
        return;
      }

      const groupedStores: Record<string, Store[]> = {};

      ((data || []) as AccountStoreRow[]).forEach((row) => {
        const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
        if (!store) return;

        groupedStores[row.account_id] = groupedStores[row.account_id] || [];
        groupedStores[row.account_id].push(store);
      });

      Object.keys(groupedStores).forEach((accountId) => {
        groupedStores[accountId].sort((a, b) => a.name.localeCompare(b.name));
      });

      setAccounts(accountData || []);
      setStoresByAccount(groupedStores);
      setCatalogsLoading(false);
    };

    const loadInitialEmployees = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .eq("active", true)
        .order("name");

      if (error) {
        console.error("Error cargando empleados:", error);
        return;
      }

      setEmployeeOptions(data || []);
    };

    loadOperationCatalogs();
    loadInitialEmployees();
  }, []);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((current) => {
      if (current.includes(accountId)) {
        setSelectedStores((stores) => {
          const next = { ...stores };
          delete next[accountId];
          return next;
        });

        return current.filter((id) => id !== accountId);
      }

      return [...current, accountId];
    });
  };

  const toggleStore = (accountId: string, storeId: string) => {
    setSelectedStores((current) => {
      const accountStores = current[accountId] || [];
      const nextStores = accountStores.includes(storeId)
        ? accountStores.filter((id) => id !== storeId)
        : [...accountStores, storeId];

      return {
        ...current,
        [accountId]: nextStores,
      };
    });
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditEmployeeId("");
    setSelectedAccounts([]);
    setSelectedStores({});
  };

  const validateFixedLength = (
    value: string,
    label: string,
    expectedLength: number
  ) => {
    if (value.trim().length !== expectedLength) {
      setMessageType("error");
      setMessage(
        `${label} debe tener exactamente ${expectedLength} caracteres.`
      );
      return false;
    }

    return true;
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (
      !validateFixedLength(form.curp, "CURP", 18) ||
      !validateFixedLength(form.rfc, "RFC", 13) ||
      !validateFixedLength(form.nss, "NSS", 11)
    ) {
      setLoading(false);
      return;
    }

    if (
      isPromoter &&
      selectedAccounts.length > 0 &&
      selectedAccounts.some((accountId) => !selectedStores[accountId]?.length)
    ) {
      setMessageType("error");
      setMessage("Selecciona al menos una tienda para cada cuenta del promotor.");
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setMessageType("error");
      setMessage("Tu sesion expiro. Inicia sesion nuevamente.");
      setLoading(false);
      return;
    }

    const response = await fetch(
      isEditMode ? "/api/admin/update-employee" : "/api/admin/create-employee",
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: editEmployeeId,
        ...form,
        name: fullName,
        accountStoreAssignments: selectedAccounts.map((accountId) => ({
          accountId,
          storeIds: selectedStores[accountId] || [],
        })),
      }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setMessageType("error");
      setMessage(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage(
      isEditMode
        ? "Expediente actualizado correctamente."
        : "Empleado creado correctamente."
    );
    resetForm();
    await loadEmployeeOptions();
    setLoading(false);
  };

  const handleGenerateContract = async () => {
    setMessage("");

    if (!contractEmployeeId) {
      setMessageType("error");
      setMessage("Selecciona un empleado para generar el contrato.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setMessageType("error");
      setMessage("Tu sesion expiro. Inicia sesion nuevamente.");
      return;
    }

    setContractLoading(true);

    try {
      const response = await fetch("/api/admin/generate-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employeeId: contractEmployeeId }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "No fue posible generar el contrato.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName =
        response.headers
          .get("content-disposition")
          ?.match(/filename="(.+)"/)?.[1] || "Contrato_empleado.docx";

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessageType("success");
      setMessage("Contrato generado correctamente.");
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Error inesperado al generar contrato."
      );
    } finally {
      setContractLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex">
      <Sidebar userName="Eduardo Palmerin" />

      <section className="flex-1 p-8">
        <div className="max-w-6xl">
          <h1 className="text-4xl font-bold text-neutral-800">
            Expediente de personal
          </h1>

          <p className="text-neutral-500 mt-2 mb-8">
            Alta completa de empleados y asignacion operativa por cuenta y tienda.
          </p>

          <section className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-800">
              Completar empleado existente
            </h2>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Empleado
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 border rounded-lg"
                  value={editEmployeeId}
                  onChange={(e) => loadEmployeeForEdit(e.target.value)}
                  disabled={editLoading}
                >
                  <option value="">Crear empleado nuevo</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} - {employee.email || employee.role}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="bg-neutral-200 hover:bg-neutral-300 text-neutral-900 font-semibold px-6 py-3 rounded-lg"
              >
                Nuevo empleado
              </button>
            </div>
          </section>

          <form onSubmit={handleSaveEmployee} className="space-y-6">
            <FormSection title="Datos personales">
              <TextInput
                label="Nombre(s)"
                value={form.firstName}
                onChange={(value) => updateField("firstName", value)}
                required
              />
              <TextInput
                label="Apellido paterno"
                value={form.paternalLastName}
                onChange={(value) => updateField("paternalLastName", value)}
                required
              />
              <TextInput
                label="Apellido materno"
                value={form.maternalLastName}
                onChange={(value) => updateField("maternalLastName", value)}
              />
              <TextInput
                label="Fecha de nacimiento"
                type="date"
                value={form.birthDate}
                onChange={(value) => updateField("birthDate", value)}
              />
              <TextInput
                label="Lugar de nacimiento"
                value={form.birthPlace}
                onChange={(value) => updateField("birthPlace", value)}
              />
              <TextInput
                label="Nacionalidad"
                value={form.nationality}
                onChange={(value) => updateField("nationality", value)}
              />
              <SelectInput
                label="Sexo"
                value={form.sex}
                onChange={(value) => updateField("sex", value)}
                options={sexOptions}
                placeholder="Selecciona sexo"
              />
              <SelectInput
                label="Estado civil"
                value={form.maritalStatus}
                onChange={(value) => updateField("maritalStatus", value)}
                options={maritalStatuses}
                placeholder="Selecciona estado civil"
              />
            </FormSection>

            <FormSection title="Documentacion">
              <TextInput
                label="CURP"
                value={form.curp}
                onChange={(value) =>
                  updateField("curp", value.toUpperCase().replace(/\s+/g, ""))
                }
                required
                minLength={18}
                maxLength={18}
              />
              <TextInput
                label="RFC"
                value={form.rfc}
                onChange={(value) =>
                  updateField("rfc", value.toUpperCase().replace(/\s+/g, ""))
                }
                required
                minLength={13}
                maxLength={13}
              />
              <TextInput
                label="Codigo postal fiscal"
                value={form.fiscalPostalCode}
                onChange={(value) =>
                  updateField("fiscalPostalCode", value.replace(/\D/g, ""))
                }
                maxLength={5}
              />
              <TextInput
                label="NSS"
                value={form.nss}
                onChange={(value) => updateField("nss", value.replace(/\D/g, ""))}
                required
                minLength={11}
                maxLength={11}
              />
            </FormSection>

            <FormSection title="Contacto">
              <TextInput
                label="Telefono"
                value={form.phone}
                onChange={(value) => updateField("phone", value)}
              />
              <TextInput
                label="Correo"
                type="email"
                value={form.email}
                onChange={(value) => updateField("email", value)}
                required={!isEditMode}
              />
            </FormSection>

            <FormSection title="Domicilio">
              <TextInput
                label="Calle"
                value={form.street}
                onChange={(value) => updateField("street", value)}
              />
              <TextInput
                label="Numero exterior"
                value={form.exteriorNumber}
                onChange={(value) => updateField("exteriorNumber", value)}
              />
              <TextInput
                label="Numero interior"
                value={form.interiorNumber}
                onChange={(value) => updateField("interiorNumber", value)}
              />
              <TextInput
                label="Colonia"
                value={form.neighborhood}
                onChange={(value) => updateField("neighborhood", value)}
              />
              <TextInput
                label="Codigo postal"
                value={form.postalCode}
                onChange={(value) => updateField("postalCode", value)}
              />
              <TextInput
                label="Municipio/Alcaldia"
                value={form.municipality}
                onChange={(value) => updateField("municipality", value)}
              />
              <TextInput
                label="Estado"
                value={form.state}
                onChange={(value) => updateField("state", value)}
              />
            </FormSection>

            <FormSection title="Informacion laboral">
              <TextInput
                label="Fecha de ingreso"
                type="date"
                value={form.hireDate}
                onChange={(value) => updateField("hireDate", value)}
              />
              <SelectInput
                label="Rol"
                value={form.role}
                onChange={(value) => updateField("role", value)}
                options={roles}
                placeholder="Selecciona rol"
                required
              />
              <SelectInput
                label="Tipo de contrato"
                value={form.contractType}
                onChange={(value) => updateField("contractType", value)}
                options={contractTypes}
                placeholder="Selecciona contrato"
              />
              <TextInput
                label="Inicio de contrato"
                type="date"
                value={form.contractStartDate}
                onChange={(value) => updateField("contractStartDate", value)}
              />
              <TextInput
                label="Fin/vigencia"
                type="date"
                value={form.contractEndDate}
                onChange={(value) => updateField("contractEndDate", value)}
              />
            </FormSection>

            <FormSection title="Nomina">
              <TextInput
                label="Sueldo"
                type="number"
                min="0"
                step="0.01"
                value={form.salary}
                onChange={(value) => updateField("salary", value)}
              />
              <SelectInput
                label="Tipo de sueldo"
                value={form.salaryPeriod}
                onChange={(value) => updateField("salaryPeriod", value)}
                options={salaryPeriods}
                placeholder="Selecciona tipo"
              />
              <SelectInput
                label="Periodicidad"
                value={form.payFrequency}
                onChange={(value) => updateField("payFrequency", value)}
                options={payFrequencies}
                placeholder="Selecciona periodicidad"
              />
              <SelectInput
                label="Tiene credito Infonavit?"
                value={form.hasInfonavitCredit}
                onChange={(value) => updateField("hasInfonavitCredit", value)}
                options={yesNoOptions}
                placeholder="Selecciona una opcion"
              />
              <TextInput
                label="Banco"
                value={form.bankName}
                onChange={(value) => updateField("bankName", value)}
              />
              <TextInput
                label="CLABE interbancaria"
                value={form.bankClabe}
                onChange={(value) =>
                  updateField("bankClabe", value.replace(/\D/g, ""))
                }
                maxLength={18}
              />
            </FormSection>

            <FormSection title="Jornada">
              <TextInput
                label="Horas semanales"
                type="number"
                min="0"
                step="0.5"
                value={form.weeklyHours}
                onChange={(value) => updateField("weeklyHours", value)}
              />
              <TextInput
                label="Dias de trabajo"
                value={form.workDays}
                onChange={(value) => updateField("workDays", value)}
              />
              <TextInput
                label="Hora entrada"
                type="time"
                value={form.workStartTime}
                onChange={(value) => updateField("workStartTime", value)}
              />
              <TextInput
                label="Inicio descanso alimentos"
                type="time"
                value={form.breakStartTime}
                onChange={(value) => updateField("breakStartTime", value)}
              />
              <TextInput
                label="Fin descanso alimentos"
                type="time"
                value={form.breakEndTime}
                onChange={(value) => updateField("breakEndTime", value)}
              />
              <TextInput
                label="Hora salida"
                type="time"
                value={form.workEndTime}
                onChange={(value) => updateField("workEndTime", value)}
              />
            </FormSection>

            {isPromoter && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-neutral-800">
                  Operacion
                </h2>

                <div className="mt-5 space-y-4">
                  {catalogsLoading && (
                    <p className="text-sm text-neutral-500">
                      Cargando cuentas y tiendas...
                    </p>
                  )}

                  {!catalogsLoading &&
                    accounts.map((account) => {
                      const accountSelected = selectedAccounts.includes(account.id);
                      const stores = storesByAccount[account.id] || [];

                      return (
                        <div
                          key={account.id}
                          className="border rounded-lg p-4 bg-neutral-50"
                        >
                          <label className="flex items-center gap-3 font-semibold text-neutral-800">
                            <input
                              type="checkbox"
                              checked={accountSelected}
                              onChange={() => toggleAccount(account.id)}
                              className="h-4 w-4"
                            />
                            {account.name}
                          </label>

                          {accountSelected && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {stores.length === 0 && (
                                <p className="text-sm text-red-600 md:col-span-2">
                                  Esta cuenta no tiene tiendas configuradas.
                                </p>
                              )}

                              {stores.map((store) => (
                                <label
                                  key={store.id}
                                  className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm text-neutral-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(
                                      selectedStores[account.id]?.includes(store.id)
                                    )}
                                    onChange={() => toggleStore(account.id, store.id)}
                                    className="mt-1 h-4 w-4"
                                  />
                                  <span>
                                    <span className="block font-medium text-neutral-900">
                                      {store.name}
                                    </span>
                                    <span className="block text-neutral-500">
                                      {[store.chain_name, store.brand_name]
                                        .filter(Boolean)
                                        .join(" / ")}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-neutral-800">
                Documentos laborales
              </h2>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    Empleado
                  </label>
                  <select
                    className="w-full mt-1 px-4 py-3 border rounded-lg"
                    value={contractEmployeeId}
                    onChange={(e) => setContractEmployeeId(e.target.value)}
                  >
                    <option value="">Selecciona empleado</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.email || employee.role}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateContract}
                  disabled={contractLoading}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-60"
                >
                  {contractLoading ? "Generando..." : "Generar contrato"}
                </button>
              </div>
            </section>

            <FormSection title="Acceso">
              <TextInput
                label="Correo"
                value={form.email}
                onChange={() => undefined}
                disabled
              />
              <TextInput
                label="Contrasena temporal"
                type="password"
                value={form.password}
                onChange={(value) => updateField("password", value)}
                required={!isEditMode}
                disabled={isEditMode}
              />
            </FormSection>

            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-neutral-500">Nombre compatible</p>
                <p className="font-semibold text-neutral-800">
                  {fullName || "Se construira con nombre y apellidos"}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || editLoading}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-60"
              >
                {loading
                  ? isEditMode
                    ? "Guardando expediente..."
                    : "Creando empleado..."
                  : isEditMode
                    ? "Guardar expediente"
                    : "Crear empleado"}
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
  type = "text",
  required = false,
  disabled = false,
  min,
  step,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  step?: string;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <input
        type={type}
        className="w-full mt-1 px-4 py-3 border rounded-lg disabled:bg-neutral-100 disabled:text-neutral-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        min={min}
        step={step}
        minLength={minLength}
        maxLength={maxLength}
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <select
        className="w-full mt-1 px-4 py-3 border rounded-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
