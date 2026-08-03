import { redirect } from "next/navigation";

/** The Six-Time Book was folded into the Karmic Management hub. Keep the old
 *  route working (bookmarks, older push notifications) by redirecting. */
export default function SixTimeBookRedirect() {
  redirect("/karmic");
}
