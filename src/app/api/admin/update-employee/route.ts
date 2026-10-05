import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type AccountStoreAssignment = {
  accountId: string;
  storeIds: string[];
};

type UpdateEmployeePayload = {
  employeeId?: string;
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
  payFrequency?: string;
  weeklyHours?: string | number;
  workDays?: string;
  workStartTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  workEndTime?: string;
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

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const cleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullableString = (value: unknown) => cleanString(value) || null;
const nullableDate = (value: unknown) => nullableString(value);
const nullableTime = (value: unknown) => nullableString(value);

const normalizedUpper = (value: unknown) => {
  const cleanValue = cleanString(value);
  return cleanValue ? cleanValue.toUpperCase().replace(/\s+/g, "") : null;
};

const nullableEnum = (value: unknown, allowedValues: Set<string>) => {
  const cleanValue = cleanString(value);
  return cleanValue && allowedValues.has(cleanValue) ? cleanValue : null;
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

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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
      return jsonError("No tienes permisos para actualizar empleados.", 403);
    }

    if (callerProfile.active === false) {
      return jsonError("El usuario administrador esta inactivo.", 403);
    }

    const body = (await request.json()) as UpdateEmployeePayload;
    const employeeId = cleanString(body.employeeId);

    if (!employeeId) {
      return jsonError("Selecciona un empleado para actualizar.", 400);
    }

    const role = cleanString(body.role);
    const firstName = cleanString(body.firstName);
    const paternalLastName = cleanString(body.paternalLastName);
    const maternalLastName = cleanString(body.maternalLastName);
    const fullName =
      [firstName, paternalLastName, maternalLastName].filter(Boolean).join(" ") ||
      cleanString(body.name);

    if (!fullName || !role) {
      return jsonError("Faltan nombre y rol del empleado.", 400);
    }

    if (!allowedRoles.has(role)) {
      return jsonError("Rol no valido.", 400);
    }

    const salary = nullableNonNegativeNumber(body.salary);
    const weeklyHours = nullableNonNegativeNumber(body.weeklyHours);

    if (Number.isNaN(salary)) {
      return jsonError("El sueldo debe ser un numero mayor o igual a cero.", 400);
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        name: fullName,
        first_name: firstName || null,
        paternal_last_name: paternalLastName || null,
        maternal_last_name: maternalLastName || null,
        email: nullableString(body.email),
        phone: nullableString(body.phone),
        role,
        hire_date: nullableDate(body.hireDate),
        curp: normalizedUpper(body.curp),
        rfc: normalizedUpper(body.rfc),
        nss: normalizedUpper(body.nss),
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
        pay_frequency: nullableEnum(body.payFrequency, allowedPayFrequencies),
        weekly_hours: weeklyHours,
        work_days: nullableString(body.workDays),
        work_start_time: nullableTime(body.workStartTime),
        break_start_time: nullableTime(body.breakStartTime),
        break_end_time: nullableTime(body.breakEndTime),
        work_end_time: nullableTime(body.workEndTime),
      })
      .eq("id", employeeId);

    if (profileError) {
      return jsonError(profileError.message, 400);
    }

    const { error: deleteAssignmentsError } = await supabaseAdmin
      .from("employee_store_assignments")
      .delete()
      .eq("employee_id", employeeId);

    if (deleteAssignmentsError) {
      return jsonError(deleteAssignmentsError.message, 400);
    }

    if (role === "PROMOTOR" && storeIds.length > 0) {
      const { error: assignmentError } = await supabaseAdmin
        .from("employee_store_assignments")
        .upsert(
          storeIds.map((storeId) => ({
            employee_id: employeeId,
            store_id: storeId,
            active: true,
          })),
          { onConflict: "employee_id,store_id" }
        );

      if (assignmentError) {
        return jsonError(assignmentError.message, 400);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Expediente actualizado correctamente.",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Error inesperado al actualizar empleado.",
      500
    );
  }
}
