import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Resolve the D1 binding. Call only from server code. */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}
