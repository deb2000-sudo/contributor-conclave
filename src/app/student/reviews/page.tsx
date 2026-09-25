import { redirect } from "next/navigation";

export default function StudentReviewsRedirect() {
  redirect("/student/submissions");
}
