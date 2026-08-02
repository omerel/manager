import { redirect } from "next/navigation";

/** Bulk intake moved onto the people page itself — the admin drops files there. */
export default function IntakeRedirect() {
  redirect("/people");
}
