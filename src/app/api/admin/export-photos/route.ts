import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { parseStoredFile } from "@/lib/storage-files";

function cleanFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const jsonError = (message: string, status: number) =>
    NextResponse.json({ error: message }, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });

  if (!token) return jsonError("No autenticado.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return jsonError("Configuracion de Supabase incompleta.", 500);
  }

  // Use the caller's JWT throughout: this export must also respect database RLS.
  const supabase = createClient(
    supabaseUrl,
    anonKey,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return jsonError("Sesion invalida.", 401);

  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single();

  if (callerError || caller?.role !== "ADMIN" || caller.active !== true) {
    return jsonError("No tienes permisos para exportar fotografias.", 403);
  }

  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const employeeId = searchParams.get("employeeId");

  if (!startDate || !endDate) {
    return jsonError("Debes enviar fecha inicio y fecha fin.", 400);
  }

  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return jsonError("El periodo de fechas no es valido.", 400);
  }
  if (employeeId && employeeId !== "all" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
    return jsonError("El empleado no es valido.", 400);
  }

  let query = supabase
    .from("attendance_records")
    .select(`
      id,
      employee_id,
      type,
      photo_url,
      created_at,
      profiles:employee_id (
        name
      )
    `)
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`)
    .not("photo_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(251);

  if (employeeId && employeeId !== "all") {
    query = query.eq("employee_id", employeeId);
  }

  const { data: records, error } = await query;

  if (error) {
    return jsonError("No fue posible consultar las fotografias.", 500);
  }

  if (!records || records.length === 0) {
    return jsonError("No hay fotos en ese periodo.", 404);
  }

  if (records.length > 250) {
    return jsonError("Demasiadas fotos. Reduce el rango de fechas o selecciona un promotor.", 413);
  }

  const zip = new JSZip();

  for (const row of records) {
    const fileReference = parseStoredFile(row.photo_url as string, supabaseUrl);
    if (!fileReference || fileReference.bucket !== "attendance-photos") {
      return jsonError("Una fotografia tiene una referencia no valida. Revisa el registro.", 400);
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("attendance-photos")
      .download(fileReference.path);

    if (downloadError || !file) {
      return jsonError("No fue posible descargar todas las fotografias. Intenta nuevamente.", 502);
    }

    const arrayBuffer = await file.arrayBuffer();

    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;

    const promotorName = cleanFileName(
      profile?.name || row.employee_id || "sin_promotor"
    );

    const date = row.created_at?.slice(0, 10) || "sin-fecha";
    const type = row.type || "registro";
    const fileName = `${date}_${type}_${row.id}.jpg`;

    zip.file(`${promotorName}/${fileName}`, arrayBuffer);
  }

  const zipArrayBuffer = await zip.generateAsync({
    type: "arraybuffer",
  });

  return new Response(zipArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fotos-asistencia_${startDate}_${endDate}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
