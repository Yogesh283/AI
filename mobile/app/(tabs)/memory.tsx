import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { NEO } from "../../constants/theme";

export default function Memory() {
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <Text style={styles.h1}>NeoXAI Memory</Text>
      <Text style={styles.sub}>What NeoXAI knows about you</Text>
      <View style={styles.card}>
        {[
          ["Name", "Aman"],
          ["Wake time", "~6:30 AM"],
          ["Preferences", "Tech, Fitness, Hinglish"],
          ["Goals", "Ship NeoXAI, stay consistent"],
        ].map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 56, paddingHorizontal: 20 },
  h1: { fontSize: 26, fontWeight: "800", color: "#fff" },
  sub: { marginTop: 6, color: NEO.muted, marginBottom: 20 },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    gap: 18,
  },
  row: { gap: 6 },
  k: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  v: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "600" },
});
