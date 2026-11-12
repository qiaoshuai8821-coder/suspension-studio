import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

import type { IdentityStage } from "../cursor/identity";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
const local = new Map<string, Promise<PGlite>>();

export async function sql<T = Record<string, unknown>>(
  stage: IdentityStage,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (stage === "production" && databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  const key = stage === "preview" ? "preview" : "local";
  let ready = local.get(key);
  if (!ready) {
    ready = startLocal(key).catch((error: unknown) => {
      local.delete(key);
      throw error;
    });
    local.set(key, ready);
  }
  return (await (await ready).query<T>(text, params)).rows;
}

async function startLocal(key: string): Promise<PGlite> {
  const dataDir = key === "preview" ? undefined : path.join(process.cwd(), ".data", "pglite");
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const db = new PGlite(dataDir);
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  return db;
}
