import type { AuthFailure, AuthSuccess } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";

export function authSuccessResponse(result: AuthSuccess, status = 200) {
  return Response.json({ user: result.user }, { status });
}

export function authFailureResponse(result: AuthFailure) {
  return Response.json(
    {
      error: result.formError ?? "Request could not be completed.",
      fieldErrors: result.fieldErrors,
    },
    { status: result.status },
  );
}

export async function establishSession(result: AuthSuccess, status = 200) {
  await createSession(result.user.id);
  return authSuccessResponse(result, status);
}
