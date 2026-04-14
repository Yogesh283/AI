import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NEO } from "../constants/theme";

const voices = [
  { id: "male", label: "Male", sub: "Deep" },
  { id: "female", label: "Female", sub: "Soft" },
  { id: "ai", label: "AI", sub: "Robotic" },
];
const chips = ["Friendly", "Professional", "Motivational", "Funny"];

export default function Customize() {
  const [voice, setVoice] = useState("male");
  const [picked, setPicked] = useState<string[]>(["Friendly"]);

  function toggle(c: string) {
    setPicked((p) =>
      p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-3)
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.h1}>Voice & Personality</Text>
        <Text style={styles.sub}>Tune how NeoXAI sounds and responds.</Text>

        <Text style={styles.section}>Select Voice</Text>
        <View style={styles.row3}>
          {voices.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setVoice(v.id)}
              style={[styles.voice, voice === v.id && styles.voiceOn]}
            >
              <Text style={styles.voiceL}>{v.label}</Text>
              <Text style={styles.voiceS}>{v.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Personality</Text>
        <View style={styles.chips}>
          {chips.map((c) => {
            const on = picked.includes(c);
            return (
              <Pressable
                key={c}
                onPress={() => toggle(c)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipT, on && styles.chipTon]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sliders}>
          <Text style={styles.sliderLabel}>Speaking speed</Text>
          <View style={styles.fakeBar} />
          <Text style={styles.sliderLabel}>Response detail</Text>
          <View style={[styles.fakeBar, { opacity: 0.7 }]} />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.cta}>
            <Text style={styles.ctaText}>Save & Continue</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 52, paddingHorizontal: 20 },
  back: { color: NEO.cyan, marginBottom: 12, fontSize: 14 },
  h1: { fontSize: 24, fontWeight: "800", color: "#fff" },
  sub: { marginTop: 6, color: NEO.muted, fontSize: 14 },
  section: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  row3: { flexDirection: "row", gap: 10 },
  voice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
  },
  voiceOn: { borderColor: NEO.cyan },
  voiceL: { color: "#fff", fontWeight: "800" },
  voiceS: { marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.4)" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipOn: { borderColor: "rgba(0,212,255,0.45)", backgroundColor: "rgba(0,212,255,0.12)" },
  chipT: { color: "rgba(255,255,255,0.55)", fontWeight: "600" },
  chipTon: { color: NEO.cyan },
  sliders: {
    marginTop: 24,
    padding: 18,
    borderRadius: 24,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    gap: 10,
  },
  sliderLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  fakeBar: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(0,212,255,0.35)",
    marginBottom: 8,
  },
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
