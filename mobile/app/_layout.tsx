import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { NEO } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: NEO.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="register" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="avatars" />
        <Stack.Screen name="customize" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}
