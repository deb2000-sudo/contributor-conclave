import Link from "next/link";

import { StudentRegisterForm } from "@/components/auth/student-register-form";
import { focusRing } from "@/components/ui/styles";

export default function StudentRegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 tabIndex={-1} className={`text-3xl font-semibold tracking-tight ${focusRing}`}>
        Student registration
      </h1>
      <StudentRegisterForm />
      <p className="text-sm">
        <Link className={`underline underline-offset-4 ${focusRing}`} href="/register/mentor">
          Register as a mentor
        </Link>{" "}
        or{" "}
        <Link className={`underline underline-offset-4 ${focusRing}`} href="/login">
          log in
        </Link>
        .
      </p>
    </main>
  );
}
