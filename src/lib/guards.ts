import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** Server-component guard: bounces signed-out visitors to the login page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Server-component guard for admin-only pages. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

/** Action guard: throws rather than redirecting, so callers can show an error. */
export async function requireAdminForAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You need to sign in.");
  if (!user.isAdmin) throw new Error("Admins only.");
  return user;
}
