import Link from "next/link";

import { MentorRegisterForm } from "@/components/auth/mentor-register-form";
import { focusRing } from "@/components/ui/styles";

export default function MentorRegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 tabIndex={-1} className={`text-3xl font-semibold tracking-tight ${focusRing}`}>
        Mentor registration
      </h1>
      <MentorRegisterForm />
      <p className="text-sm">
        <Link className={`underline underline-offset-4 ${focusRing}`} href="/register/student">
          Register as a student
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
