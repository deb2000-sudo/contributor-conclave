import { authenticate } from "@/lib/auth/accounts";
import { authFailureResponse, establishSession } from "@/lib/auth/http";
import {
  AUTH_LIMIT_MESSAGE,
  clientAddress,
  loginAttemptAllowed,
  recordLoginFailure,
} from "@/lib/auth/throttle";
import { loginSchema, toFieldErrors } from "@/lib/auth/validation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Enter a valid email and password.",
        fieldErrors: toFieldErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const address = clientAddress(request.headers.get("x-forwarded-for"));
  if (!loginAttemptAllowed(parsed.data.email, address)) {
    return Response.json({ error: AUTH_LIMIT_MESSAGE }, { status: 429 });
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    recordLoginFailure(parsed.data.email, address);
    return authFailureResponse(result);
  }

  return establishSession(result, 200);
}
