import { supabase } from "./supabase";

export function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export async function attachSignedUrls(rows, bucket, field = "file_url", expiresIn = 3600) {
  if (!Array.isArray(rows) || rows.length === 0) return rows ?? [];

  const paths = Array.from(new Set(rows.map((row) => row[field]).filter((value) => value && !isHttpUrl(value))));
  if (paths.length === 0) {
    return rows.map((row) => ({ ...row, preview_url: row[field] }));
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) {
    return rows.map((row) => ({ ...row, preview_url: isHttpUrl(row[field]) ? row[field] : null }));
  }

  const signedMap = new Map(paths.map((path, index) => [path, data[index]?.signedUrl ?? null]));
  return rows.map((row) => ({
    ...row,
    preview_url: isHttpUrl(row[field]) ? row[field] : signedMap.get(row[field]) ?? null,
  }));
}
