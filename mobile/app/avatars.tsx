import { Redirect } from "expo-router";

/** Avatar picker removed — legacy route forwards to Customize. */
export default function AvatarsRedirect() {
  return <Redirect href="/customize" />;
}
