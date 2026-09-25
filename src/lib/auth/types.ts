import type { Role } from "@/generated/prisma/client";

export type PublicUser = {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
};

export const publicUserSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;
