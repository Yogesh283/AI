import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NEO, neoGradientPrimary } from "../constants/theme";
import { neoUi } from "../constants/neoUi";

const features = [
  { t: "Chat & Voice", d: "Hindi / English companion", i: "💬" },
  { t: "Smart Memory", d: "NeoXAI remembers what matters", i: "🧠" },
  { t: "Your space", d: "Profile, voice persona, and settings", i: "✨" },
];

export default function Onboarding() {
  return (
    <View style={neoUi.screen}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Meet NeoXAI</Text>
        <Text style={styles.subhead}>Your personal AI companion</Text>
        <View style={neoUi.dividerGrad} />
        <Text style={styles.tagline}>Real-time · Personalized · Smart</Text>
        {features.map((f) => (
          <View key={f.t} style={[styles.card, neoUi.glassCardGlow]}>
            <Text style={styles.emoji}>{f.i}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.t}</Text>
              <Text style={styles.cardDesc}>{f.d}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable style={[neoUi.outlineCta, styles.actionBtn]} onPress={() => router.replace("/(tabs)")}>
          <Text style={neoUi.outlineCtaText}>Skip</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/customize")} style={styles.actionBtn}>
          <LinearGradient colors={[...neoGradientPrimary]} style={[neoUi.primaryCta, { marginTop: 0 }]}>
            <Text style={neoUi.primaryCtaText}>Next</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 120 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subhead: {
    marginTop: 8,
    color: NEO.cyan,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
  tagline: { marginTop: 14, color: NEO.muted, textAlign: "center", fontSize: 13 },
  card: {
    flexDirection: "row",
    gap: 14,
    marginTop: 14,
    padding: 18,
  },
  emoji: { fontSize: 26 },
  cardTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cardDesc: { marginTop: 4, color: "rgba(255,255,255,0.52)", fontSize: 14, lineHeight: 20 },
  actions: {
    position: "absolute",
    bottom: 28,
    left: 20,
    right: 20,
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: { flex: 1 },
});
