import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { loginApi, saveSession } from "../lib/auth";
import { NEO, neoGradientPrimary } from "../constants/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
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

  const pad = {
    paddingTop: Math.max(insets.top, 12) + 8,
    paddingHorizontal: 22,
    paddingBottom: Math.max(insets.bottom, 16) + 24,
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, pad]}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
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
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.35)"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />

          {err ? (
            <Text style={styles.err} accessibilityRole="alert">
              {err}
            </Text>
          ) : null}

          <Pressable onPress={() => void submit()} disabled={loading} style={styles.ctaWrap}>
            <LinearGradient colors={[...neoGradientPrimary]} style={styles.cta}>
              <Text style={styles.ctaT}>{loading ? "Signing in…" : "Sign in"}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.push("/register")} style={styles.linkWrap}>
            <Text style={styles.link}>
              New here? <Text style={styles.linkBold}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  back: { color: NEO.cyan, marginBottom: 18, fontSize: 15 },
  h1: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  sub: { marginTop: 8, color: NEO.muted, fontSize: 15, lineHeight: 22, marginBottom: 22 },
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
    paddingVertical: Platform.select({ ios: 15, android: 13 }),
    color: "#fff",
    fontSize: 16,
  },
  err: { marginTop: 12, color: "#f87171", fontSize: 14 },
  ctaWrap: { marginTop: 14 },
  cta: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  ctaT: { color: "#050912", fontWeight: "900", fontSize: 16 },
  linkWrap: { marginTop: 28, alignItems: "center", paddingBottom: 8 },
  link: { color: NEO.muted, fontSize: 15, textAlign: "center" },
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
