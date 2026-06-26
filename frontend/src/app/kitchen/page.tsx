import { redirect } from "next/navigation";

/** Kitchen UI disabled for now — staff use POS instead. */
export default function KitchenPage() {
  redirect("/pos");
}
