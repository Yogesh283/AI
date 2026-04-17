import { redirect } from "next/navigation";

/** Standalone 3D chat page hidden from nav — 3D avatar lives on `/voice`. */
export default function Avatar3DPage() {
  redirect("/voice");
}
