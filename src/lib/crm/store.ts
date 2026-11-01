import { createClient } from "redis";
import type { CallRecord, Customer, Job, JobStatus } from "./types";

// Storage, picked from whichever env vars exist:
//   1. Upstash REST   (UPSTASH_REDIS_REST_URL/_TOKEN or KV_REST_API_URL/_TOKEN): plain HTTPS
//   2. Standard Redis (REDIS_URL, what Vercel's "Redis" integration provides): normal Redis connection
//   3. Neither: in-memory, so local development and tests work. It forgets everything on restart: NOT for production.
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL;

export const storeMode: "rest" | "redis" | "memory" = URL_ && TOKEN ? "rest" : REDIS_URL ? "redis" : "memory";
export const isPersistent = storeMode !== "memory";

type Cmd = (string | number)[];

// One connection per server instance, reused between requests; reconnects if it drops.
type TcpClient = { isOpen: boolean; connect(): Promise<unknown>; sendCommand(args: string[]): Promise<unknown> };
const gc = globalThis as unknown as { __redisClient?: TcpClient };
async function tcp(...cmd: Cmd): Promise<unknown> {
  if (!gc.__redisClient) {
    const c = createClient({ url: REDIS_URL, socket: { connectTimeout: 8000 } });
    c.on("error", () => {}); // errors surface on the command that hits them
    gc.__redisClient = c as unknown as TcpClient;
  }
  const client = gc.__redisClient;
  if (!client.isOpen) await client.connect();
  return client.sendCommand(cmd.map(String));
}

async function redis(...cmd: Cmd): Promise<unknown> {
  if (storeMode === "redis") return tcp(...cmd);
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error("Redis command failed");
  return data.result;
}

type Mem = { kv: Map<string, string>; z: Map<string, Map<string, number>> };
const g = globalThis as unknown as { __crmMem?: Mem };
const mem: Mem = (g.__crmMem ??= { kv: new Map(), z: new Map() });

async function put(key: string, value: unknown) {
  const s = JSON.stringify(value);
  if (isPersistent) await redis("SET", key, s);
  else mem.kv.set(key, s);
}
async function fetchOne<T>(key: string): Promise<T | null> {
  const raw = isPersistent ? ((await redis("GET", key)) as string | null) : (mem.kv.get(key) ?? null);
  return raw ? (JSON.parse(raw) as T) : null;
}
async function fetchMany<T>(keys: string[]): Promise<T[]> {
  if (!keys.length) return [];
  const raws = isPersistent ? ((await redis("MGET", ...keys)) as (string | null)[]) : keys.map((k) => mem.kv.get(k) ?? null);
  return raws.filter((r): r is string => !!r).map((r) => JSON.parse(r) as T);
}
async function index(set: string, score: number, member: string) {
  if (isPersistent) await redis("ZADD", set, score, member);
  else (mem.z.get(set) ?? mem.z.set(set, new Map()).get(set)!).set(member, score);
}
async function newest(set: string, limit: number): Promise<string[]> {
  if (isPersistent) return (await redis("ZRANGE", set, 0, limit - 1, "REV")) as string[];
  return [...(mem.z.get(set) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([m]) => m);
}

export async function saveJob(job: Job) {
  await put(`job:${job.id}`, job);
  await index("jobs", Date.parse(job.startsAt), job.id);
}
export async function listJobs(limit = 500): Promise<Job[]> {
  return fetchMany<Job>((await newest("jobs", limit)).map((id) => `job:${id}`));
}
export async function setJobStatus(id: string, status: JobStatus) {
  const job = await fetchOne<Job>(`job:${id}`);
  if (job) await put(`job:${id}`, { ...job, status });
}

export async function saveCall(patch: Partial<CallRecord> & { id: string; at: number }) {
  const prev = await fetchOne<CallRecord>(`call:${patch.id}`);
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await put(`call:${patch.id}`, { ...prev, ...clean });
  await index("calls", patch.at, patch.id);
}
export async function listCalls(limit = 200): Promise<CallRecord[]> {
  return fetchMany<CallRecord>((await newest("calls", limit)).map((id) => `call:${id}`));
}

/** Customers are derived from jobs and calls, keyed by phone number. */
export async function listCustomers(): Promise<Customer[]> {
  const [jobs, calls] = await Promise.all([listJobs(), listCalls()]);
  const map = new Map<string, Customer>();
  const row = (phone: string) => map.get(phone) ?? map.set(phone, { phone, name: "", jobs: 0, spent: 0, calls: 0, lastSeen: 0 }).get(phone)!;
  for (const j of jobs) {
    if (!j.customerPhone) continue;
    const c = row(j.customerPhone);
    c.name = c.name || j.customerName;
    if (j.status !== "cancelled") { c.jobs++; c.spent += j.price; }
    c.lastSeen = Math.max(c.lastSeen, Date.parse(j.startsAt));
  }
  for (const k of calls) {
    if (!k.fromNumber) continue;
    const c = row(k.fromNumber);
    c.calls++;
    c.lastSeen = Math.max(c.lastSeen, k.at);
  }
  return [...map.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}
