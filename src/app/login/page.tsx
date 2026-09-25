import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { focusRing } from "@/components/ui/styles";
import { homeForRole } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(homeForRole(user.role));
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 tabIndex={-1} className={`text-3xl font-semibold tracking-tight ${focusRing}`}>
        Log in
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Use the email and password for your contributor-conclave account.
      </p>
      <LoginForm />
      <p className="text-sm">
        New here?{" "}
        <Link className={`underline underline-offset-4 ${focusRing}`} href="/register/student">
          Register as a student
        </Link>{" "}
        or{" "}
        <Link className={`underline underline-offset-4 ${focusRing}`} href="/register/mentor">
          register as a mentor
        </Link>
        .
      </p>
    </main>
  );
}
