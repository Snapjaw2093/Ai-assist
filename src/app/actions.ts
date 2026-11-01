"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE, isSignedIn, newSessionValue, passwordMatches } from "@/lib/crm/auth";
import { setJobStatus } from "@/lib/crm/store";
import { JOB_STATUSES, type JobStatus } from "@/lib/crm/types";

export async function login(formData: FormData) {
  const ok = passwordMatches(String(formData.get("password") ?? ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
    redirect("/login?error=1");
  }
  const s = newSessionValue();
  (await cookies()).set(COOKIE, s.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: s.maxAge });
  redirect("/dashboard");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

export async function updateJobStatus(formData: FormData) {
  // Server actions are public endpoints: always re-check the session here.
  if (!(await isSignedIn())) redirect("/login");
  const status = String(formData.get("status")) as JobStatus;
  if (!JOB_STATUSES.includes(status)) return;
  await setJobStatus(String(formData.get("id")), status);
  revalidatePath("/dashboard", "layout");
}
