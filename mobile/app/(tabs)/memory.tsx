import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DASHBOARD } from "../../../web/src/shared/neoContent";
import { NEO } from "../../constants/theme";
import { neoUi } from "../../constants/neoUi";

const demoFacts = [
  { k: "Wake time", v: "~6:30 AM", icon: "sunny-outline" as const },
  { k: "Preferences", v: "Tech, fitness, Hinglish", icon: "heart-outline" as const },
  { k: "Goals", v: "Stay consistent & ship", icon: "flag-outline" as const },
];

export default function Memory() {
  return (
    <View style={neoUi.screen}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[
          neoUi.padScreen,
          { paddingBottom: 120, paddingTop: 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={[styles.titleIcon, neoUi.glassCard]}>
            <Ionicons name="library" size={22} color={NEO.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={neoUi.h1Sm}>Neo memory</Text>
            <Text style={neoUi.sub}>What your assistant remembers</Text>
          </View>
        </View>

        <View style={neoUi.dividerGrad} />

        <Text style={neoUi.section}>Highlights</Text>
        <View style={[styles.card, neoUi.glassCardGlow]}>
          {DASHBOARD.memoryLines.map((line) => (
            <View key={line.text} style={styles.memRow}>
              <View style={[styles.accent, { backgroundColor: toneDot(line.tone) }]} />
              <Text style={styles.memText}>{line.text}</Text>
            </View>
          ))}
        </View>

        <Text style={neoUi.section}>About you</Text>
        <View style={[styles.card, neoUi.glassCard]}>
          {demoFacts.map((row) => (
            <View key={row.k} style={styles.factBlock}>
              <View style={styles.factHead}>
                <Ionicons name={row.icon} size={16} color={NEO.cyan} />
                <Text style={styles.factK}>{row.k}</Text>
              </View>
              <Text style={styles.factV}>{row.v}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.hint, neoUi.glassCard]}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.45)" />
          <Text style={styles.hintT}>
            Live memory server se sync ho sakti hai — yeh preview NeoXAI theme ke saath match karti hai.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function toneDot(t: "cyan" | "magenta" | "purple") {
  if (t === "cyan") return NEO.cyan;
  if (t === "magenta") return NEO.magenta;
  return NEO.purple;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  titleIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { padding: 18, gap: 14 },
  memRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  accent: { width: 4, marginTop: 4, borderRadius: 2, minHeight: 36 },
  memText: { flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 22, fontWeight: "500" },
  factBlock: { gap: 6 },
  factHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  factK: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.38)",
    textTransform: "uppercase",
  },
  factV: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600", marginLeft: 24 },
  hint: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
    padding: 16,
    alignItems: "flex-start",
  },
  hintT: { flex: 1, color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19 },
});
