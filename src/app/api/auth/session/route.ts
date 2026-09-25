import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  return Response.json({ user });
}
