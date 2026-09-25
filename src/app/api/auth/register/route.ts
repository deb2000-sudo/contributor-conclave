import { registerMentor, registerStudent } from "@/lib/auth/accounts";
import { authFailureResponse, establishSession } from "@/lib/auth/http";
import {
  AUTH_LIMIT_MESSAGE,
  clientAddress,
  recordRegistration,
  registrationAllowed,
} from "@/lib/auth/throttle";
import {
  mentorRegistrationSchema,
  studentRegistrationSchema,
  toFieldErrors,
} from "@/lib/auth/validation";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const address = clientAddress(request.headers.get("x-forwarded-for"));
  if (!registrationAllowed(address)) {
    return Response.json({ error: AUTH_LIMIT_MESSAGE }, { status: 429 });
  }
  recordRegistration(address);

  const body = await readJson(request);

  if (!body || typeof body !== "object" || !("role" in body)) {
    return Response.json(
      { error: "Choose a student or mentor account." },
      { status: 400 },
    );
  }

  const role = body.role;

  if (role === "ADMIN" || (role !== "STUDENT" && role !== "MENTOR")) {
    return Response.json(
      { error: "That role cannot be registered." },
      { status: 400 },
    );
  }

  if (role === "STUDENT") {
    const parsed = studentRegistrationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Check the registration details.", fieldErrors: toFieldErrors(parsed.error) },
        { status: 400 },
      );
    }

    const result = await registerStudent(parsed.data);
    return result.ok ? establishSession(result, 201) : authFailureResponse(result);
  }

  const parsed = mentorRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Check the registration details.", fieldErrors: toFieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const result = await registerMentor(parsed.data);
  return result.ok ? establishSession(result, 201) : authFailureResponse(result);
}
