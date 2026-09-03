import { redirect } from "next/navigation";
import { MCQS_PATH } from "@/lib/auth/paths";

export default function Page() {
  redirect(MCQS_PATH);
}
