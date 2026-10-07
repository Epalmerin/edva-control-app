import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SearsLettersPayload = {
  employeeId?: string;
  date?: string;
  storeName?: string;
  validityStartDate?: string;
  validityEndDate?: string;
  workDays?: string;
  workSchedule?: string;
  imei?: string;
  phoneBrand?: string;
  phoneColor?: string;
};

type Profile = {
  id: string;
  name: string | null;
  first_name: string | null;
  paternal_last_name: string | null;
  maternal_last_name: string | null;
  nss: string | null;
};

const templates = [
  {
    path: "sears-carta-1.docx",
    outputName: "Carta_1",
  },
  {
    path: "sears-carta-celular.docx",
    outputName: "Carta_Celular",
  },
  {
    path: "sears-nuevo-formato.docx",
    outputName: "Nuevo_Formato",
  },
];

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const clean = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

const employeeFullName = (profile: Profile) =>
  [
    profile.paternal_last_name,
    profile.maternal_last_name,
    profile.first_name,
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ") || clean(profile.name);

const formatLongDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(Date.UTC(year, month - 1, day));
  return capitalize(
    date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
  );
};

const formatDateWithoutWeekday = (value: string, includeYear: boolean) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
};

const formatValidityRange = (startDate: string, endDate: string) => {
  const startYear = startDate.split("-")[0];
  const endYear = endDate.split("-")[0];

  return `${formatDateWithoutWeekday(
    startDate,
    startYear !== endYear
  )} al ${formatDateWithoutWeekday(endDate, true)}`;
};

async function renderDocx(templatePath: string, variables: Record<string, string>) {
  const template = await readFile(path.join(process.cwd(), "templates", templatePath));
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

  return zip.generateAsync({ type: "nodebuffer" });
}

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
      return jsonError("No tienes permisos para generar cartas.", 403);
    }

    const body = (await request.json()) as SearsLettersPayload;
    const employeeId = clean(body.employeeId);

    if (!employeeId) {
      return jsonError("Selecciona un empleado.", 400);
    }

    const requiredFields = [
      ["date", "Fecha"],
      ["storeName", "Tienda"],
      ["validityStartDate", "Inicio de vigencia"],
      ["validityEndDate", "Termino de vigencia"],
      ["workDays", "Dias de trabajo"],
      ["workSchedule", "Horario"],
      ["imei", "IMEI"],
      ["phoneBrand", "Marca"],
      ["phoneColor", "Color"],
    ] as const;

    const missingBodyFields = requiredFields.filter(([key]) => !clean(body[key]));

    if (missingBodyFields.length > 0) {
      return jsonError(
        `Faltan datos para generar cartas: ${missingBodyFields
          .map(([, label]) => label)
          .join(", ")}.`,
        400
      );
    }

    if (
      clean(body.validityStartDate) &&
      clean(body.validityEndDate) &&
      clean(body.validityEndDate) < clean(body.validityStartDate)
    ) {
      return jsonError("La vigencia final debe ser posterior al inicio.", 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, first_name, paternal_last_name, maternal_last_name, nss")
      .eq("id", employeeId)
      .single<Profile>();

    if (profileError || !profile) {
      return jsonError("No fue posible cargar el empleado.", 400);
    }

    const fullName = employeeFullName(profile);
    const nss = clean(profile.nss);

    if (!fullName || !nss) {
      return jsonError("El empleado debe tener nombre completo y NSS.", 400);
    }

    const variables: Record<string, string> = {
      DATE: formatLongDate(clean(body.date)),
      STORE_NAME: clean(body.storeName).toUpperCase(),
      FULL_NAME: fullName.toUpperCase(),
      NSS: nss,
      LETTER_VALIDITY_RANGE: formatValidityRange(
        clean(body.validityStartDate),
        clean(body.validityEndDate)
      ),
      WORK_DAYS: clean(body.workDays),
      WORK_SCHEDULE: clean(body.workSchedule),
      IMEI: clean(body.imei),
      PHONE_BRAND: clean(body.phoneBrand).toUpperCase(),
      PHONE_COLOR: clean(body.phoneColor).toUpperCase(),
    };

    const outputZip = new JSZip();
    const baseName = safeFileName(fullName || "empleado");

    await Promise.all(
      templates.map(async (template) => {
        const docx = await renderDocx(template.path, variables);
        outputZip.file(`${template.outputName}_${baseName}.docx`, docx);
      })
    );

    const output = await outputZip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Cartas_Sears_${baseName}.zip"`,
      },
    });
  } catch (error: unknown) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Error inesperado al generar cartas.",
      500
    );
  }
}
