import { redirect } from "next/navigation";

export default function AdminQueueRedirect() {
  redirect("/admin/submissions?status=PENDING");
}
