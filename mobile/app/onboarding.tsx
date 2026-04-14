import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NEO } from "../constants/theme";

const features = [
  { t: "Chat & Voice", d: "Hindi / English companion", i: "💬" },
  { t: "Smart Memory", d: "NeoXAI remembers what matters", i: "🧠" },
  { t: "AI Tools", d: "Writer, image, code, planner", i: "✨" },
];

export default function Onboarding() {
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Meet NeoXAI — Your Personal AI Companion</Text>
        <Text style={styles.sub}>Real-time · Personalized · Smart</Text>
        {features.map((f) => (
          <View key={f.t} style={styles.card}>
            <Text style={styles.emoji}>{f.i}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.t}</Text>
              <Text style={styles.cardDesc}>{f.d}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable style={styles.outline} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.outlineText}>Skip</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/avatars")}>
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.solid}>
            <Text style={styles.solidText}>Next</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 56 },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  sub: { marginTop: 10, color: NEO.muted, textAlign: "center", fontSize: 14 },
  card: {
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    padding: 18,
    borderRadius: 24,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
  },
  emoji: { fontSize: 26 },
  cardTitle: { color: NEO.cyan, fontWeight: "700", fontSize: 16 },
  cardDesc: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 14 },
  actions: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 12,
  },
  outline: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  outlineText: { color: "#fff", fontWeight: "600" },
  solid: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  solidText: { color: "#050912", fontWeight: "800", fontSize: 15 },
});
