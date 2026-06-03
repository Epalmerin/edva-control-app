import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

function cleanFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const zip = new JSZip();

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: records, error } = await supabase
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
    .gte("created_at", sevenDaysAgo)
    .not("photo_url", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const row of records || []) {
    const url = row.photo_url as string;

    const marker = "/attendance-photos/";
    const photoPath = url.split(marker)[1];

    if (!photoPath) continue;

    const { data: file, error: downloadError } = await supabase.storage
      .from("attendance-photos")
      .download(photoPath);

    if (downloadError || !file) continue;

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
      "Content-Disposition":
        'attachment; filename="fotos-asistencia-ultimos-7-dias.zip"',
    },
  });
}