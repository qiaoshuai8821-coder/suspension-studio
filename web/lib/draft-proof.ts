// 浏览器在发起生成前要解的一道短运算题。
// 服务端只验一次哈希，不把模型调用暴露给没有这道题的请求。

export const PROOF_BITS = 14;

export async function digestHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasLeadingZeroBits(hex: string, bits: number): boolean {
  const fullNibbles = Math.floor(bits / 4);
  if (!hex.startsWith("0".repeat(fullNibbles))) return false;
  const remainder = bits % 4;
  if (remainder === 0) return true;
  const nibble = Number.parseInt(hex[fullNibbles] ?? "f", 16);
  return nibble < 2 ** (4 - remainder);
}

export async function proofIsValid(id: string, nonce: string, salt: string): Promise<boolean> {
  if (!/^[0-9]{1,7}$/.test(salt)) return false;
  const hex = await digestHex(`${id}:${nonce}:${salt}`);
  return hasLeadingZeroBits(hex, PROOF_BITS);
}

export async function solveProof(id: string, nonce: string): Promise<string | null> {
  const limit = 1 << (PROOF_BITS + 2);
  for (let index = 0; index < limit; index += 1) {
    const salt = String(index);
    if (await proofIsValid(id, nonce, salt)) return salt;
  }
  return null;
}
