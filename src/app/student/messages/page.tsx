import { redirect } from "next/navigation";

export default function StudentMessagesRedirect() {
  redirect("/student/chat");
}
