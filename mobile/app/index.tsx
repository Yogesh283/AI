import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SPLASH } from "../../web/src/shared/neoContent";
import { NEO } from "../constants/theme";

const LOGO = require("../assets/neo-logo.png");

export default function Splash() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setP((x) => (x >= 100 ? 100 : x + 3)), 70);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0B0E14", "#05070C"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.hero}>
        <LinearGradient
          colors={["rgba(0,212,255,0.35)", "rgba(189,0,255,0.2)"]}
          style={styles.logoGlow}
        />
        <View style={styles.logoRing}>
          <Image
            source={LOGO}
            style={styles.logoImg}
            resizeMode="contain"
            accessibilityLabel="NeoXAI logo"
          />
        </View>
      </View>
      <Text style={styles.tag}>{SPLASH.tagline}</Text>
      <View style={styles.footer}>
        <Text style={styles.loading}>{SPLASH.loadingLabel.toUpperCase()}</Text>
        <View style={styles.barBg}>
          <LinearGradient
            colors={[NEO.cyan, NEO.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${p}%` }]}
          />
        </View>
        <Pressable onPress={() => router.push("/onboarding")}>
          <Text style={styles.start}>Start</Text>
        </Pressable>
        <View style={styles.authRow}>
          <Pressable onPress={() => router.push("/login")}>
            <Text style={styles.authLink}>Login</Text>
          </Pressable>
          <Text style={styles.authDot}> · </Text>
          <Pressable onPress={() => router.push("/register")}>
            <Text style={styles.authLink}>Register</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skip}>Skip to app</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEO.bg,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 72,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  hero: {
    marginTop: 24,
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.75,
  },
  logoRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(10,16,32,0.65)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: NEO.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 16,
  },
  logoImg: {
    width: "88%",
    height: "88%",
  },
  tag: {
    marginTop: 8,
    color: NEO.muted,
    fontSize: 14,
  },
  footer: {
    width: "100%",
    maxWidth: 360,
    gap: 16,
    alignItems: "center",
  },
  loading: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    letterSpacing: 3,
  },
  barBg: {
    width: "100%",
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  start: {
    color: NEO.cyan,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },
  authRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  authLink: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "700",
  },
  authDot: { color: "rgba(255,255,255,0.35)", fontSize: 14 },
  skip: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
  },
});
