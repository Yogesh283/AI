import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getNeoAvatar,
  readStoredAvatarId,
  writeStoredAvatarId,
} from "../constants/avatars";
import { NEO } from "../constants/theme";

const avatars = [
  { id: "neo-core", name: "NeoXAI Core", tag: "Smart & Balanced", premium: false },
  { id: "nova", name: "Nova", tag: "Friendly & Warm", premium: false },
  { id: "atlas", name: "Atlas", tag: "Professional", premium: true },
  { id: "spark", name: "Spark", tag: "Energetic", premium: false },
  { id: "luna", name: "Luna", tag: "Calm & Creative", premium: true },
  { id: "astra", name: "Astra", tag: "Strategic", premium: false },
];

export default function Avatars() {
  const [tab, setTab] = useState<"all" | "free" | "premium">("all");
  const [sel, setSel] = useState("neo-core");

  useEffect(() => {
    readStoredAvatarId().then((id) => {
      if (id) setSel(id);
    });
  }, []);

  useEffect(() => {
    writeStoredAvatarId(sel);
  }, [sel]);

  const list = avatars.filter((a) => {
    if (tab === "free") return !a.premium;
    if (tab === "premium") return a.premium;
    return true;
  });

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <Text style={styles.h1}>Choose Your Neo</Text>
      <Text style={styles.sub}>Select your personal AI companion.</Text>
      <View style={styles.tabs}>
        {(["all", "free", "premium"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {list.map((a) => {
          const on = sel === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => setSel(a.id)}
              style={[styles.card, on && styles.cardOn]}
            >
              {on && (
                <LinearGradient
                  colors={[NEO.cyan, NEO.magenta]}
                  style={styles.check}
                >
                  <Text style={styles.checkTxt}>✓</Text>
                </LinearGradient>
              )}
              <View style={styles.portrait}>
                <Text style={{ fontSize: 44 }}>{getNeoAvatar(a.id).emoji}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.name}>{a.name}</Text>
                {a.premium ? <Text>👑</Text> : null}
              </View>
              <Text style={styles.tag}>{a.tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          onPress={async () => {
            await writeStoredAvatarId(sel);
            router.push("/customize");
          }}
        >
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.cta}>
            <Text style={styles.ctaText}>Continue with Neo</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 52, paddingHorizontal: 20 },
  h1: { fontSize: 24, fontWeight: "800", color: "#fff" },
  sub: { marginTop: 6, color: NEO.muted, fontSize: 14 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 4,
    borderRadius: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabOn: { backgroundColor: "rgba(0,212,255,0.2)" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  tabTextOn: { color: "#fff" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 120,
  },
  card: {
    width: "48%",
    backgroundColor: NEO.glass,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: NEO.border,
  },
  cardOn: {
    borderColor: NEO.cyan,
    shadowColor: NEO.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  check: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  checkTxt: { color: "#050912", fontWeight: "900", fontSize: 12 },
  portrait: {
    height: 100,
    borderRadius: 18,
    backgroundColor: "#121a2e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontWeight: "800", color: "#fff", fontSize: 15 },
  tag: { marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.4)" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(6,9,16,0.96)",
  },
  cta: { paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  ctaText: { color: "#050912", fontWeight: "900", fontSize: 16 },
});
