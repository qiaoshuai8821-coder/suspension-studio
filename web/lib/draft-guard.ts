// 生成接口的调用校验：必须从本站页面拿到一次性题目，并遵守次数限制。
// 题目和计数都在这台进程的内存里，不把密钥写进日志。

import { proofIsValid } from "./draft-proof";

const HOUR_MS = 60 * 60 * 1000;
const TICKET_WINDOW_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const MAX_PER_IP_PER_HOUR = 6;
const MAX_INFLIGHT_PER_IP = 1;
const MAX_GLOBAL_INFLIGHT = 3;
const MAX_GLOBAL_PER_HOUR = 30;
const MAX_TICKETS_PER_IP = 12;

type Challenge = {
  nonce: string;
  ip: string;
  expiresAt: number;
};

type Bucket = {
  stamps: number[];
  inflight: number;
  tickets: number[];
};

const challenges = new Map<string, Challenge>();
const buckets = new Map<string, Bucket>();
const globalStamps: number[] = [];
let globalInflight = 0;

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim() ?? "";
  if (first) return first.slice(0, 80);
  const real = request.headers.get("x-real-ip")?.trim() ?? "";
  return (real || "unknown").slice(0, 80);
}

export function fromOurPage(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function bucketFor(ip: string): Bucket {
  const existing = buckets.get(ip);
  if (existing) return existing;
  const created: Bucket = { stamps: [], inflight: 0, tickets: [] };
  buckets.set(ip, created);
  return created;
}

function prune(now: number) {
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(id);
  }
  if (challenges.size > 400) {
    const oldest = challenges.keys().next().value;
    if (oldest) challenges.delete(oldest);
  }
  for (const [ip, bucket] of buckets) {
    bucket.stamps = bucket.stamps.filter((stamp) => now - stamp < HOUR_MS);
    bucket.tickets = bucket.tickets.filter((stamp) => now - stamp < TICKET_WINDOW_MS);
    if (bucket.inflight === 0 && bucket.stamps.length === 0 && bucket.tickets.length === 0) {
      buckets.delete(ip);
    }
  }
  while (globalStamps.length > 0 && now - globalStamps[0] >= HOUR_MS) globalStamps.shift();
}

export function issueChallenge(ip: string): { id: string; nonce: string } | { error: string } {
  const now = Date.now();
  prune(now);
  const bucket = bucketFor(ip);
  if (bucket.tickets.length >= MAX_TICKETS_PER_IP) {
    return { error: "校验发得太频繁了，请过一会儿再试。" };
  }
  bucket.tickets.push(now);
  const id = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  challenges.set(id, { nonce, ip, expiresAt: now + CHALLENGE_TTL_MS });
  return { id, nonce };
}

export async function openDraftGate(
  ip: string,
  proof: { id: string; nonce: string; salt: string },
): Promise<{ ok: true; release: () => void } | { ok: false; error: string; status: number }> {
  const now = Date.now();
  prune(now);
  const challenge = challenges.get(proof.id);
  if (!challenge || challenge.expiresAt <= now || challenge.nonce !== proof.nonce || challenge.ip !== ip) {
    return { ok: false, error: "请从工作台页面重新发起生成。", status: 403 };
  }
  challenges.delete(proof.id);
  if (!(await proofIsValid(proof.id, proof.nonce, proof.salt))) {
    return { ok: false, error: "页面校验没有通过，请再生成一次。", status: 403 };
  }

  const bucket = bucketFor(ip);
  if (bucket.inflight >= MAX_INFLIGHT_PER_IP || globalInflight >= MAX_GLOBAL_INFLIGHT) {
    return { ok: false, error: "已经有一份在写，请等它完成。", status: 429 };
  }
  if (bucket.stamps.length >= MAX_PER_IP_PER_HOUR || globalStamps.length >= MAX_GLOBAL_PER_HOUR) {
    return { ok: false, error: "生成太频繁了，请过一会儿再试。", status: 429 };
  }

  bucket.inflight += 1;
  bucket.stamps.push(now);
  globalInflight += 1;
  globalStamps.push(now);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      bucket.inflight = Math.max(0, bucket.inflight - 1);
      globalInflight = Math.max(0, globalInflight - 1);
    },
  };
}
