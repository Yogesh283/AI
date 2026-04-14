import { LinearGradient } from "expo-linear-gradient";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { googleLoginApi, saveSession } from "../lib/auth";
import { NEO } from "../constants/theme";

const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export function GoogleAuthButton({ mode }: { mode: "login" | "register" }) {
  if (!web) return null;
  return <GoogleAuthButtonInner mode={mode} />;
}

function GoogleAuthButtonInner({ mode }: { mode: "login" | "register" }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: web,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || web,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || web,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params?.id_token;
    if (typeof idToken !== "string" || !idToken) {
      setErr("Google did not return an ID token");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await googleLoginApi(idToken);
        if (cancelled) return;
        await saveSession(data.access_token, data.user);
        router.replace(mode === "register" ? "/onboarding" : "/(tabs)");
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Google sign-in failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [response, mode]);

  if (!request) return null;

  return (
    <View style={styles.wrap}>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable
        onPress={() => {
          void promptAsync();
        }}
        disabled={loading}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient colors={["#1a2332", "#121820"]} style={styles.googleBtn}>
          <Text style={styles.googleBtnT}>
            {loading ? "Connecting…" : "Continue with Google"}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  err: { marginBottom: 8, color: "#f87171", fontSize: 13 },
  googleBtn: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: NEO.border,
  },
  googleBtnT: { color: "rgba(255,255,255,0.92)", fontWeight: "800", fontSize: 15 },
});
