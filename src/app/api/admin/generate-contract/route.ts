import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type Profile = {
  id: string;
  name: string | null;
  first_name: string | null;
  paternal_last_name: string | null;
  maternal_last_name: string | null;
  email: string | null;
  role: string | null;
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  sex: string | null;
  marital_status: string | null;
  curp: string | null;
  rfc: string | null;
  nss: string | null;
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  municipality: string | null;
  state: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  salary: number | string | null;
  pay_frequency: string | null;
  weekly_hours: number | string | null;
  work_days: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
};

type StoreAssignment = {
  store_id: string;
  stores: {
    name: string | null;
    address: string | null;
    chain_name: string | null;
    brand_name: string | null;
  } | null;
};

type AccountStore = {
  account_id: string;
  accounts: {
    name: string | null;
  } | null;
};

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const relation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value;

const clean = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatDate = (value: string | null) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatTime = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 5);
};

const formatMoney = (value: number) =>
  value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const units = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
];

const teens = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciseis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];

const tens = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const hundreds = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function numberToWords(value: number): string {
  if (value === 0) return "cero";
  if (value === 100) return "cien";
  if (value < 10) return units[value];
  if (value < 20) return teens[value - 10];
  if (value < 30) {
    if (value === 20) return "veinte";
    return `veinti${units[value - 20]}`;
  }
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    return unit ? `${tens[ten]} y ${units[unit]}` : tens[ten];
  }
  if (value < 1000) {
    const hundred = Math.floor(value / 100);
    const rest = value % 100;
    return rest ? `${hundreds[hundred]} ${numberToWords(rest)}` : hundreds[hundred];
  }
  if (value < 1000000) {
    const thousand = Math.floor(value / 1000);
    const rest = value % 1000;
    const prefix = thousand === 1 ? "mil" : `${numberToWords(thousand)} mil`;
    return rest ? `${prefix} ${numberToWords(rest)}` : prefix;
  }
  const million = Math.floor(value / 1000000);
  const rest = value % 1000000;
  const prefix =
    million === 1 ? "un millon" : `${numberToWords(million)} millones`;
  return rest ? `${prefix} ${numberToWords(rest)}` : prefix;
}

const moneyToWords = (value: number) => {
  const pesos = Math.floor(value);
  const cents = Math.round((value - pesos) * 100);
  return `${capitalize(numberToWords(pesos))} pesos ${String(cents).padStart(
    2,
    "0"
  )}/100 M.N.`;
};

const formatDuration = (startDate: string | null, endDate: string | null) => {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "";
  }

  let months = 0;
  let cursor = new Date(start);

  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    const nextPeriodEnd = new Date(next);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() - 1);

    if (nextPeriodEnd <= end) {
      months += 1;
      cursor = next;
    } else {
      break;
    }
  }

  const days =
    Math.floor((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const parts = [];

  if (months > 0) {
    parts.push(months === 1 ? "1 MES" : `${months} MESES`);
  }

  if (days > 0) {
    parts.push(days === 1 ? "1 DIA" : `${days} DIAS`);
  }

  return parts.join(" ");
};

const labelMap: Record<string, Record<string, string>> = {
  sex: {
    FEMALE: "FEMENINO",
    MALE: "MASCULINO",
    OTHER: "OTRO",
  },
  maritalStatus: {
    SINGLE: "SOLTERO",
    SINGLE_MALE: "SOLTERO",
    SINGLE_FEMALE: "SOLTERA",
    MARRIED: "CASADO",
    MARRIED_MALE: "CASADO",
    MARRIED_FEMALE: "CASADA",
    DIVORCED: "DIVORCIADO",
    DIVORCED_MALE: "DIVORCIADO",
    DIVORCED_FEMALE: "DIVORCIADA",
    WIDOWED: "VIUDO",
    WIDOWED_MALE: "VIUDO",
    WIDOWED_FEMALE: "VIUDA",
    COMMON_LAW: "UNION LIBRE",
    OTHER: "OTRO",
  },
  payFrequency: {
    DAILY: "diaria",
    WEEKLY: "semanal",
    BIWEEKLY: "quincenal",
  },
};

const fullAddress = (profile: Profile) =>
  [
    profile.street,
    profile.exterior_number ? `NUMERO ${profile.exterior_number}` : "",
    profile.interior_number ? `INTERIOR ${profile.interior_number}` : "",
    profile.neighborhood ? `COLONIA ${profile.neighborhood}` : "",
    profile.postal_code ? `C.P. ${profile.postal_code}` : "",
    profile.municipality,
    profile.state,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");

const formatMaritalStatus = (profile: Profile) => {
  const maritalStatus = clean(profile.marital_status);
  const sex = clean(profile.sex);

  if (maritalStatus === "SINGLE") {
    return sex === "FEMALE" ? "SOLTERA" : "SOLTERO";
  }

  if (maritalStatus === "MARRIED") {
    return sex === "FEMALE" ? "CASADA" : "CASADO";
  }

  if (maritalStatus === "DIVORCED") {
    return sex === "FEMALE" ? "DIVORCIADA" : "DIVORCIADO";
  }

  if (maritalStatus === "WIDOWED") {
    return sex === "FEMALE" ? "VIUDA" : "VIUDO";
  }

  return labelMap.maritalStatus[maritalStatus] || maritalStatus;
};

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Configuracion de Supabase incompleta.", 500);
  }

  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return jsonError("No autenticado.", 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonError("Sesion invalida.", 401);
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", userData.user.id)
      .single();

    if (callerProfileError || callerProfile?.role !== "ADMIN") {
      return jsonError("No tienes permisos para generar contratos.", 403);
    }

    const body = (await request.json()) as { employeeId?: string };
    const employeeId = clean(body.employeeId);

    if (!employeeId) {
      return jsonError("Selecciona un empleado.", 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", employeeId)
      .single<Profile>();

    if (profileError || !profile) {
      return jsonError("No fue posible cargar el expediente del empleado.", 400);
    }

    const { data: assignments } = await supabase
      .from("employee_store_assignments")
      .select(
        `
        store_id,
        stores:store_id (
          name,
          address,
          chain_name,
          brand_name
        )
      `
      )
      .eq("employee_id", employeeId)
      .eq("active", true)
      .returns<StoreAssignment[]>();

    const firstStore = relation(assignments?.[0]?.stores || null);
    const firstStoreId = assignments?.[0]?.store_id;

    let accountName = "";

    if (firstStoreId) {
      const { data: accountStore } = await supabase
        .from("account_stores")
        .select(
          `
          account_id,
          accounts:account_id (
            name
          )
        `
        )
        .eq("store_id", firstStoreId)
        .limit(1)
        .maybeSingle<AccountStore>();

      accountName = relation(accountStore?.accounts || null)?.name || "";
    }

    const salary = Number(profile.salary || 0);
    const workStart = formatTime(profile.work_start_time);
    const breakStart = formatTime(profile.break_start_time);
    const breakEnd = formatTime(profile.break_end_time);
    const workEnd = formatTime(profile.work_end_time);
    const mealBreakText =
      breakStart && breakEnd
        ? `con un descanso para alimentos de ${breakStart} a ${breakEnd}`
        : "";
    const workSchedule =
      workStart && breakStart && breakEnd && workEnd
        ? `${workStart} a ${breakStart} y de ${breakEnd} a ${workEnd}, ${mealBreakText}`
        : workStart && workEnd
          ? `${workStart} a ${workEnd}`
          : "";

    const variables: Record<string, string> = {
      FULL_NAME: clean(profile.name),
      FIRST_NAME: clean(profile.first_name),
      PATERNAL_LAST_NAME: clean(profile.paternal_last_name),
      MATERNAL_LAST_NAME: clean(profile.maternal_last_name),
      BIRTH_DATE: formatDate(profile.birth_date),
      BIRTH_PLACE: clean(profile.birth_place),
      NATIONALITY: clean(profile.nationality),
      SEX: labelMap.sex[clean(profile.sex)] || clean(profile.sex),
      MARITAL_STATUS: formatMaritalStatus(profile),
      CURP: clean(profile.curp),
      RFC: clean(profile.rfc),
      NSS: clean(profile.nss),
      FULL_ADDRESS: fullAddress(profile),
      CONTRACT_START_DATE: formatDate(profile.contract_start_date),
      CONTRACT_END_DATE: formatDate(profile.contract_end_date),
      CONTRACT_DURATION: formatDuration(
        profile.contract_start_date,
        profile.contract_end_date
      ),
      WEEKLY_HOURS: profile.weekly_hours
        ? `${clean(profile.weekly_hours)} HORAS`
        : "",
      WORK_DAYS: clean(profile.work_days),
      WORK_START_TIME: workStart,
      BREAK_START_TIME: breakStart,
      BREAK_END_TIME: breakEnd,
      WORK_END_TIME: workEnd,
      MEAL_BREAK_TEXT: mealBreakText,
      WORK_SCHEDULE: workSchedule,
      MONTHLY_SALARY: salary ? formatMoney(salary) : "",
      MONTHLY_SALARY_TEXT: salary ? moneyToWords(salary) : "",
      PAY_FREQUENCY:
        labelMap.payFrequency[clean(profile.pay_frequency)] ||
        clean(profile.pay_frequency),
      STORE_NAME: clean(firstStore?.name),
      STORE_ADDRESS: clean(firstStore?.address),
      ACCOUNT_NAME: accountName,
    };

    const missing = [
      ["FULL_NAME", "Nombre completo"],
      ["CURP", "CURP"],
      ["RFC", "RFC"],
      ["NSS", "NSS"],
      ["FULL_ADDRESS", "Domicilio"],
      ["CONTRACT_START_DATE", "Inicio de contrato"],
      ["CONTRACT_END_DATE", "Fin de contrato"],
      ["MONTHLY_SALARY", "Sueldo"],
      ["PAY_FREQUENCY", "Periodicidad de pago"],
    ].filter(([key]) => !variables[key]);

    if (missing.length > 0) {
      return jsonError(
        `Faltan datos para generar el contrato: ${missing
          .map(([, label]) => label)
          .join(", ")}.`,
        400
      );
    }

    const templatePath = path.join(
      process.cwd(),
      "templates",
      "contrato-empleado-edva.docx"
    );
    const template = await readFile(templatePath);
    const zip = await JSZip.loadAsync(template);
    const xmlFiles = Object.keys(zip.files).filter((fileName) =>
      /^word\/(document|header|footer|footnotes|endnotes).*\.xml$/.test(fileName)
    );

    await Promise.all(
      xmlFiles.map(async (fileName) => {
        const file = zip.file(fileName);
        if (!file) return;

        let xml = await file.async("string");
        Object.entries(variables).forEach(([key, value]) => {
          xml = xml.split(`{{${key}}}`).join(xmlEscape(value));
        });
        zip.file(fileName, xml);
      })
    );

    const output = await zip.generateAsync({ type: "nodebuffer" });
    const fileName = `Contrato_${safeFileName(profile.name || "empleado")}.docx`;

    return new NextResponse(new Blob([new Uint8Array(output)]), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Error inesperado al generar contrato.",
      500
    );
  }
}
