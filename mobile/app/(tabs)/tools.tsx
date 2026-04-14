import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NEO } from "../../constants/theme";

const tools = [
  { icon: "✍️", t: "Writer", d: "Write anything", b: NEO.cyan },
  { icon: "🖼", t: "Image", d: "Generate images", b: NEO.magenta },
  { icon: "💻", t: "Code", d: "Generate code", b: NEO.purple },
  { icon: "📄", t: "Summarize", d: "Summarize text", b: "#22d3ee" },
  { icon: "🌐", t: "Translator", d: "Translate text", b: "#e879f9" },
  { icon: "📋", t: "Planner", d: "Create plans", b: "#a78bfa" },
];

export default function Tools() {
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <Text style={styles.h1}>AI Tools</Text>
      <Text style={styles.sub}>Hub for specialized utilities</Text>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {tools.map((x) => (
          <View key={x.t} style={[styles.card, { borderColor: x.b }]}>
            <Text style={styles.emoji}>{x.icon}</Text>
            <Text style={styles.title}>{x.t}</Text>
            <Text style={styles.desc}>{x.d}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 56, paddingHorizontal: 20 },
  h1: { fontSize: 26, fontWeight: "800", color: "#fff" },
  sub: { marginTop: 6, color: NEO.muted, marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 24 },
  card: {
    width: "47%",
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 2,
  },
  emoji: { fontSize: 28, marginBottom: 8 },
  title: { color: NEO.cyan, fontWeight: "800", fontSize: 16 },
  desc: { marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 12 },
});
