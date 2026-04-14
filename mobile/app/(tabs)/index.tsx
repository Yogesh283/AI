import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DASHBOARD, REF_TASKS } from "../../../web/src/shared/neoContent";
import { getStoredUser } from "../../lib/auth";
import { NEO } from "../../constants/theme";

const LOGO = require("../../assets/neo-logo.png");

const REF_ICONS: ComponentProps<typeof Ionicons>["name"][] = [
  "document-text-outline",
  "image-outline",
  "mail-outline",
  "barbell-outline",
];

const MAIN_TILE_ICONS: ComponentProps<typeof Ionicons>["name"][] = [
  "chatbubble-ellipses-outline",
  "mic-outline",
  "image-outline",
  "flash-outline",
];

const QUICK_ICONS: ComponentProps<typeof Ionicons>["name"][] = [
  "chatbubble-ellipses-outline",
  "mic-outline",
  "image-outline",
  "flash-outline",
];

function toneColor(t: "cyan" | "magenta" | "purple") {
  if (t === "cyan") return NEO.cyan;
  if (t === "magenta") return NEO.magenta;
  return NEO.purple;
}

export default function Dashboard() {
  const [name, setName] = useState("there");

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then((u) => {
        if (u?.display_name) setName(u.display_name.split(" ")[0] || u.display_name);
      });
    }, [])
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroLogo}>
          <LinearGradient
            colors={["rgba(0,212,255,0.25)", "rgba(189,0,255,0.15)"]}
            style={styles.logoGlow}
          />
          <Image source={LOGO} style={styles.logoImg} resizeMode="contain" accessibilityLabel="NeoXAI" />
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello,</Text>
            <Text style={styles.name}>
              {name} <Text>👋</Text>
            </Text>
            <Text style={styles.subline}>{DASHBOARD.greetingLine}</Text>
          </View>
          <View style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.8)" />
          </View>
        </View>

        <Text style={styles.section}>{DASHBOARD.overviewTitle}</Text>
        <View style={styles.stats}>
          {DASHBOARD.stats.map((x) => (
            <View key={x.l} style={styles.stat}>
              <Text style={[styles.statN, { color: toneColor(x.tone) }]}>{x.n}</Text>
              <Text style={styles.statL}>{x.l}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>{DASHBOARD.quickTasksTitle}</Text>
        <View style={styles.refGrid}>
          {REF_TASKS.map((t, i) => (
            <Pressable
              key={t.label}
              style={styles.refTile}
              onPress={() => router.push(t.mobilePath as never)}
            >
              <Ionicons name={REF_ICONS[i] ?? "flash-outline"} size={26} color={NEO.cyan} />
              <Text style={styles.refTileT}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.micHero}
          onPress={() => router.push("/(tabs)/voice")}
          accessibilityRole="button"
          accessibilityLabel="Voice — speak to Neo"
        >
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.micHeroGrad}>
            <Ionicons name="mic" size={34} color="#050912" />
          </LinearGradient>
          <Text style={styles.micHeroLabel}>Tap to speak</Text>
        </Pressable>

        <Text style={styles.section}>Shortcuts</Text>
        <View style={styles.grid}>
          {DASHBOARD.mainTiles.map((t, i) => (
            <Pressable
              key={t.label}
              style={styles.tile}
              onPress={() => router.push(t.mobilePath as never)}
            >
              <Ionicons name={MAIN_TILE_ICONS[i] ?? "flash-outline"} size={28} color={NEO.cyan} />
              <Text style={styles.tileT}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Quick Actions</Text>
        <View style={styles.quick}>
          {DASHBOARD.quickActions.map((q, i) => (
            <Pressable
              key={q.label}
              style={styles.qItem}
              onPress={() => router.push(q.mobilePath as never)}
            >
              <Ionicons name={QUICK_ICONS[i] ?? "flash-outline"} size={24} color="rgba(255,255,255,0.75)" />
              <Text style={styles.qLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>{DASHBOARD.memoryTitle}</Text>
        <View style={styles.mem}>
          {DASHBOARD.memoryLines.map((line) => (
            <Text key={line.text} style={styles.memLine}>
              <Text style={{ color: toneColor(line.tone) }}>▸ </Text>
              {line.text}
            </Text>
          ))}
        </View>
        <Pressable onPress={() => router.push("/chat")} style={{ marginTop: 16 }}>
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.openChat}>
            <Text style={styles.openChatT}>{DASHBOARD.openChat}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 52, paddingHorizontal: 20 },
  heroLogo: {
    alignItems: "center",
    marginBottom: 8,
    height: 120,
    justifyContent: "center",
  },
  logoGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.85,
  },
  logoImg: { width: 100, height: 100 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  hello: { color: NEO.muted, fontSize: 14 },
  name: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 4 },
  subline: { marginTop: 6, fontSize: 15, color: "rgba(0,212,255,0.9)", fontWeight: "600" },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: 10,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  stat: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
  },
  statN: { fontSize: 24, fontWeight: "800" },
  statL: { marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: "600" },
  refGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  refTile: {
    width: "48%",
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    gap: 10,
    minHeight: 100,
  },
  refTileT: { color: "#fff", fontWeight: "700", fontSize: 14 },
  micHero: { alignItems: "center", marginVertical: 16 },
  micHeroGrad: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NEO.cyan,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 18,
  },
  micHeroLabel: { marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  tile: {
    width: "47%",
    minHeight: 100,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: NEO.border,
    gap: 6,
  },
  tileT: { color: "#fff", fontWeight: "800", fontSize: 15, marginTop: 4 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  qItem: {
    width: "22%",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  qLabel: { marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.45)", textAlign: "center" },
  mem: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    gap: 10,
  },
  memLine: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  openChat: { paddingVertical: 14, borderRadius: 18, alignItems: "center" },
  openChatT: { color: "#050912", fontWeight: "900", fontSize: 15 },
});
