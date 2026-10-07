import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type AccountStoreAssignment = {
  accountId: string;
  storeIds: string[];
};

type CreateEmployeePayload = {
  name?: string;
  firstName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  sex?: string;
  maritalStatus?: string;
  curp?: string;
  rfc?: string;
  fiscalPostalCode?: string;
  nss?: string;
  phone?: string;
  email?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  municipality?: string;
  state?: string;
  hireDate?: string;
  role?: string;
  contractType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  salary?: string | number;
  salaryPeriod?: string;
  payFrequency?: string;
  hasInfonavitCredit?: string;
  bankName?: string;
  bankClabe?: string;
  weeklyHours?: string | number;
  workDays?: string;
  workStartTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  workEndTime?: string;
  password?: string;
  accountStoreAssignments?: AccountStoreAssignment[];
};

const allowedRoles = new Set([
  "ADMIN",
  "PROMOTOR",
  "SUPERVISOR",
  "SUPERVISOR_VILLARREAL",
  "RH",
]);

const allowedMaritalStatuses = new Set([
  "SINGLE",
  "SINGLE_MALE",
  "SINGLE_FEMALE",
  "MARRIED",
  "MARRIED_MALE",
  "MARRIED_FEMALE",
  "DIVORCED",
  "DIVORCED_MALE",
  "DIVORCED_FEMALE",
  "WIDOWED",
  "WIDOWED_MALE",
  "WIDOWED_FEMALE",
  "COMMON_LAW",
  "OTHER",
]);

const allowedSexValues = new Set(["FEMALE", "MALE", "OTHER"]);

const allowedContractTypes = new Set([
  "INDEFINITE",
  "FIXED_TERM",
  "TRIAL",
  "TEMPORARY",
]);

const allowedPayFrequencies = new Set(["DAILY", "WEEKLY", "BIWEEKLY"]);
const allowedSalaryPeriods = new Set(["MONTHLY", "WEEKLY", "DAILY"]);

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const cleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullableString = (value: unknown) => cleanString(value) || null;

const normalizedUpper = (value: unknown) => {
  const cleanValue = cleanString(value);
  return cleanValue ? cleanValue.toUpperCase().replace(/\s+/g, "") : null;
};

const normalizedDigits = (value: unknown) => {
  const cleanValue = cleanString(value).replace(/\D/g, "");
  return cleanValue || null;
};

const exactLengthValue = (
  value: string | null,
  label: string,
  expectedLength: number
) => {
  if (!value || value.length !== expectedLength) {
    return `${label} debe tener exactamente ${expectedLength} caracteres.`;
  }

  return null;
};

const nullableBoolean = (value: unknown) => {
  const cleanValue = cleanString(value);
  if (cleanValue === "YES") return true;
  if (cleanValue === "NO") return false;
  return null;
};

const nullableDate = (value: unknown) => nullableString(value);

const nullableTime = (value: unknown) => nullableString(value);

const nullableEnum = (value: unknown, allowedValues: Set<string>) => {
  const cleanValue = cleanString(value);
  return cleanValue && allowedValues.has(cleanValue) ? cleanValue : null;
};

const nullableSalary = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;

  const numericValue =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return Number.NaN;
  }

  return numericValue;
};

const nullableNonNegativeNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;

  const numericValue =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return Number.NaN;
  }

  return numericValue;
};

const compactUnique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Configuracion de Supabase incompleta.", 500);
  }

  const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;
  let createdUserId: string | null = null;
  let profileCreated = false;

  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return jsonError("No autenticado.", 401);
    }

    const supabaseRequest = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await supabaseRequest.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonError("Sesion invalida.", 401);
    }

    const { data: callerProfile, error: callerProfileError } =
      await supabaseRequest
        .from("profiles")
        .select("role, active")
        .eq("id", userData.user.id)
        .single();

    if (callerProfileError || callerProfile?.role !== "ADMIN") {
      return jsonError("No tienes permisos para crear empleados.", 403);
    }

    if (callerProfile.active === false) {
      return jsonError("El usuario administrador esta inactivo.", 403);
    }

    const body = (await request.json()) as CreateEmployeePayload;

    if (!serviceRoleKey || serviceRoleKey.includes("dummy")) {
      return jsonError(
        "Falta configurar la llave privada SUPABASE_SERVICE_ROLE_KEY real para poder crear usuarios.",
        500
      );
    }

    if (!supabaseAdmin) {
      return jsonError("Configuracion de Supabase incompleta.", 500);
    }

    const email = cleanString(body.email).toLowerCase();
    const role = cleanString(body.role);
    const password = cleanString(body.password);
    const firstName = cleanString(body.firstName);
    const paternalLastName = cleanString(body.paternalLastName);
    const maternalLastName = cleanString(body.maternalLastName);
    const fullName =
      [firstName, paternalLastName, maternalLastName].filter(Boolean).join(" ") ||
      cleanString(body.name);

    if (!fullName || !email || !role || !password) {
      return jsonError("Faltan datos obligatorios.", 400);
    }

    if (!allowedRoles.has(role)) {
      return jsonError("Rol no valido.", 400);
    }

    const salary = nullableSalary(body.salary);
    const weeklyHours = nullableNonNegativeNumber(body.weeklyHours);
    const curp = normalizedUpper(body.curp);
    const rfc = normalizedUpper(body.rfc);
    const nss = normalizedDigits(body.nss);
    const fiscalPostalCode = normalizedDigits(body.fiscalPostalCode);
    const bankClabe = normalizedDigits(body.bankClabe);
    const fixedLengthError =
      exactLengthValue(curp, "CURP", 18) ||
      exactLengthValue(rfc, "RFC", 13) ||
      exactLengthValue(nss, "NSS", 11);

    if (Number.isNaN(salary)) {
      return jsonError("El sueldo debe ser un numero mayor o igual a cero.", 400);
    }

    if (fixedLengthError) {
      return jsonError(fixedLengthError, 400);
    }

    if (bankClabe && bankClabe.length !== 18) {
      return jsonError(
        "La CLABE interbancaria debe tener exactamente 18 digitos.",
        400
      );
    }

    if (Number.isNaN(weeklyHours)) {
      return jsonError(
        "Las horas semanales deben ser un numero mayor o igual a cero.",
        400
      );
    }

    const contractStartDate = nullableDate(body.contractStartDate);
    const contractEndDate = nullableDate(body.contractEndDate);

    if (
      contractStartDate &&
      contractEndDate &&
      contractEndDate < contractStartDate
    ) {
      return jsonError(
        "La fecha fin de contrato debe ser posterior al inicio.",
        400
      );
    }

    const accountAssignments = body.accountStoreAssignments || [];
    const requestedPairs = accountAssignments.flatMap((assignment) =>
      (assignment.storeIds || []).map((storeId) => ({
        accountId: cleanString(assignment.accountId),
        storeId: cleanString(storeId),
      }))
    );
    const validRequestedPairs = requestedPairs.filter(
      (pair) => pair.accountId && pair.storeId
    );
    const storeIds = compactUnique(validRequestedPairs.map((pair) => pair.storeId));
    const accountIds = compactUnique(
      validRequestedPairs.map((pair) => pair.accountId)
    );

    if (validRequestedPairs.length > 0) {
      const { data: accountStores, error: accountStoresError } =
        await supabaseAdmin
          .from("account_stores")
          .select("account_id, store_id")
          .in("account_id", accountIds)
          .in("store_id", storeIds);

      if (accountStoresError) {
        return jsonError(
          "No fue posible validar las tiendas de la cuenta.",
          400
        );
      }

      const allowedPairs = new Set(
        (accountStores || []).map(
          (item: { account_id: string; store_id: string }) =>
            `${item.account_id}:${item.store_id}`
        )
      );

      const invalidPair = validRequestedPairs.find(
        (pair) => !allowedPairs.has(`${pair.accountId}:${pair.storeId}`)
      );

      if (invalidPair) {
        return jsonError(
          "Una tienda seleccionada no pertenece a la cuenta indicada.",
          400
        );
      }
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return jsonError(authError?.message || "No fue posible crear Auth.", 400);
    }

    createdUserId = authData.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: createdUserId,
      name: fullName,
      first_name: firstName || null,
      paternal_last_name: paternalLastName || null,
      maternal_last_name: maternalLastName || null,
      email,
      phone: nullableString(body.phone),
      role,
      hire_date: nullableDate(body.hireDate),
      curp,
      rfc,
      fiscal_postal_code: fiscalPostalCode,
      nss,
      birth_date: nullableDate(body.birthDate),
      birth_place: nullableString(body.birthPlace),
      nationality: nullableString(body.nationality),
      sex: nullableEnum(body.sex, allowedSexValues),
      marital_status: nullableEnum(body.maritalStatus, allowedMaritalStatuses),
      street: nullableString(body.street),
      exterior_number: nullableString(body.exteriorNumber),
      interior_number: nullableString(body.interiorNumber),
      neighborhood: nullableString(body.neighborhood),
      postal_code: nullableString(body.postalCode),
      municipality: nullableString(body.municipality),
      state: nullableString(body.state),
      contract_type: nullableEnum(body.contractType, allowedContractTypes),
      contract_start_date: contractStartDate,
      contract_end_date: contractEndDate,
      salary,
      salary_period: nullableEnum(body.salaryPeriod, allowedSalaryPeriods),
      pay_frequency: nullableEnum(body.payFrequency, allowedPayFrequencies),
      has_infonavit_credit: nullableBoolean(body.hasInfonavitCredit),
      bank_name: nullableString(body.bankName),
      bank_clabe: bankClabe,
      weekly_hours: weeklyHours,
      work_days: nullableString(body.workDays),
      work_start_time: nullableTime(body.workStartTime),
      break_start_time: nullableTime(body.breakStartTime),
      break_end_time: nullableTime(body.breakEndTime),
      work_end_time: nullableTime(body.workEndTime),
      active: true,
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    profileCreated = true;

    if (role === "PROMOTOR" && storeIds.length > 0) {
      const { error: assignmentError } = await supabaseAdmin
        .from("employee_store_assignments")
        .upsert(
          storeIds.map((storeId) => ({
            employee_id: createdUserId,
            store_id: storeId,
            active: true,
          })),
          { onConflict: "employee_id,store_id" }
        );

      if (assignmentError) {
        throw new Error(assignmentError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Empleado creado correctamente.",
    });
  } catch (error) {
    if (createdUserId && supabaseAdmin) {
      if (profileCreated) {
        await supabaseAdmin
          .from("employee_store_assignments")
          .delete()
          .eq("employee_id", createdUserId);

        await supabaseAdmin.from("profiles").delete().eq("id", createdUserId);
      }

      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado al crear empleado.";

    return jsonError(message, 400);
  }
}
