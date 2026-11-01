import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// One shared password (DASHBOARD_PASSWORD). A successful login sets a signed, httpOnly cookie.
// Changing the password signs everyone out.
export const COOKIE = "ai_assist_session";
const WEEK_MS = 7 * 24 * 3600 * 1000;

const password = () => process.env.DASHBOARD_PASSWORD ?? "";
const key = () => createHash("sha256").update(`ai-assist|${password()}`).digest();
const sign = (exp: string) => createHmac("sha256", key()).update(exp).digest("hex");

export const authConfigured = () => password().length >= 8;

export function passwordMatches(input: string): boolean {
  if (!authConfigured()) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(password()).digest();
  return timingSafeEqual(a, b);
}

export function newSessionValue() {
  const exp = String(Date.now() + WEEK_MS);
  return { value: `${exp}.${sign(exp)}`, maxAge: WEEK_MS / 1000 };
}

export function sessionValid(value: string | undefined): boolean {
  if (!value || !authConfigured()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function isSignedIn() {
  return sessionValid((await cookies()).get(COOKIE)?.value);
}

export async function requireSession() {
  if (!(await isSignedIn())) redirect("/login");
}
