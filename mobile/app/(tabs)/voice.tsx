import { Redirect } from "expo-router";

/** Voice is combined with chat on the assistant tab. */
export default function VoiceTab() {
  return <Redirect href="/(tabs)" />;
}
