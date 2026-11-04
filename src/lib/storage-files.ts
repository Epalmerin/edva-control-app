import type { SupabaseClient } from "@supabase/supabase-js";

const protectedBuckets = new Set(["attendance-photos", "warranty-photos", "incidence-files"]);
export type StoredFile = { bucket: string; path: string };

function safePath(encodedPath: string): string | null {
  try {
    const parts = encodedPath.split("/").map(decodeURIComponent);
    if (parts.length < 2 || parts.some((part) =>
      !part || part === "." || part === ".." || /[%\\/\u0000-\u001f]/.test(part)
    )) return null;
    return parts.join("/");
  } catch {
    return null;
  }
}

// Existing public URLs are references only; never open or fetch them directly.
export function parseStoredFile(reference: string, projectUrl: string): StoredFile | null {
  try {
    let bucket: string;
    let encodedPath: string;
    if (reference.startsWith("storage://")) {
      const match = /^storage:\/\/([^/]+)\/(.+)$/.exec(reference);
      if (!match || /[?#]/.test(reference)) return null;
      bucket = match[1];
      encodedPath = match[2];
    } else {
      // Reject traversal before URL normalizes dot segments.
      if (/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(reference)) return null;
      const url = new URL(reference);
      if (url.origin !== new URL(projectUrl).origin || url.search || url.hash || url.username || url.password) return null;
      const match = /^\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/.exec(url.pathname);
      if (!match) return null;
      bucket = match[1];
      encodedPath = match[2];
    }
    const path = safePath(encodedPath);
    return protectedBuckets.has(bucket) && path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

export function storedFileReference(bucket: string, path: string): string {
  if (!protectedBuckets.has(bucket) || safePath(path) !== path) throw new Error("Ruta de archivo no valida.");
  return `storage://${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function downloadProtectedFile(
  client: Pick<SupabaseClient, "storage">,
  reference: string,
  projectUrl: string
): Promise<Blob> {
  const file = parseStoredFile(reference, projectUrl);
  if (!file) throw new Error("La referencia del archivo no es valida.");
  const { data, error } = await client.storage.from(file.bucket).download(file.path);
  if (error || !data) throw new Error("No fue posible abrir el archivo. Verifica tu sesion y tus permisos.");
  return data;
}
