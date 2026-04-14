import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { loginApi, saveSession } from "../lib/auth";
import { NEO } from "../constants/theme";

export default function LoginScreen() {
  const hasGoogle = Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      const data = await loginApi({ email: email.trim(), password });
      await saveSession(data.access_token, data.user);
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.h1}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to continue with NeoXAI</Text>

      {hasGoogle ? (
        <>
          <GoogleAuthButton mode="login" />
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>
        </>
      ) : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor="rgba(255,255,255,0.35)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor="rgba(255,255,255,0.35)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable onPress={submit} disabled={loading} style={{ marginTop: 8 }}>
        <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.cta}>
          <Text style={styles.ctaT}>{loading ? "Signing in…" : "Sign in"}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => router.push("/register")} style={styles.linkWrap}>
        <Text style={styles.link}>
          New here? <Text style={styles.linkBold}>Create an account</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 56, paddingHorizontal: 24 },
  back: { color: NEO.cyan, marginBottom: 20, fontSize: 14 },
  h1: { fontSize: 26, fontWeight: "800", color: "#fff" },
  sub: { marginTop: 8, color: NEO.muted, fontSize: 14, marginBottom: 24 },
  label: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
  },
  input: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NEO.border,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
  },
  err: { marginTop: 12, color: "#f87171", fontSize: 13 },
  cta: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    opacity: 1,
  },
  ctaT: { color: "#050912", fontWeight: "900", fontSize: 16 },
  linkWrap: { marginTop: 28, alignItems: "center" },
  link: { color: NEO.muted, fontSize: 14 },
  linkBold: { color: NEO.cyan, fontWeight: "800" },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  orText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "800",
    letterSpacing: 2,
  },
});
