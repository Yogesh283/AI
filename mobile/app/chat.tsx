import { Redirect } from "expo-router";

/** Chat lives on the main assistant tab together with voice. */
export default function ChatScreen() {
  return <Redirect href="/(tabs)" />;
}
