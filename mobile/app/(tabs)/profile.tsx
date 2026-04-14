import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { NEO } from "../../constants/theme";

const rows = [
  "Account Settings",
  "Avatar & Voice",
  "Notifications",
  "Privacy & Security",
  "Subscription · Pro Plan",
];

export default function Profile() {
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <View style={styles.head}>
        <Text style={styles.avatar}>👤</Text>
        <Text style={styles.name}>Aman</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeT}>Premium User</Text>
        </View>
      </View>
      <View style={styles.list}>
        {rows.map((r) => (
          <View key={r} style={styles.row}>
            <Text style={styles.rowT}>{r}</Text>
            <Text style={styles.chev}>›</Text>
          </View>
        ))}
      </View>
      <View style={styles.logout}>
        <Text style={styles.logoutT}>Logout</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 56, paddingHorizontal: 20 },
  head: { alignItems: "center", marginBottom: 24 },
  avatar: { fontSize: 64, marginBottom: 8 },
  name: { fontSize: 22, fontWeight: "800", color: "#fff" },
  badge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(189,0,255,0.35)",
    backgroundColor: "rgba(189,0,255,0.1)",
  },
  badgeT: { color: "#e9c2ff", fontWeight: "800", fontSize: 12 },
  list: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: NEO.border,
    backgroundColor: NEO.glass,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowT: { color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  chev: { color: "rgba(255,255,255,0.25)", fontSize: 18 },
  logout: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  logoutT: { color: "rgba(248,113,113,0.95)", fontWeight: "800" },
});
