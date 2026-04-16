import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SPLASH } from "../../web/src/shared/neoContent";
import { NEO, neoGradientPrimary } from "../constants/theme";

const LOGO = require("../assets/neo-logo.png");

const STAR_POS = [
  [8, 12],
  [22, 18],
  [78, 14],
  [88, 22],
  [14, 28],
  [72, 32],
  [45, 8],
];

export default function Splash() {
  const [progress, setProgress] = useState(0);
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((x) => (x >= 100 ? 100 : x + 2.2));
    }, 70);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spinA, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const b = Animated.loop(
      Animated.timing(spinB, {
        toValue: 1,
        duration: 38000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [spinA, spinB]);

  const rotA = spinA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const rotB = spinB.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#050a18", "#070d1c", "#05070c"]}
        style={StyleSheet.absoluteFill}
      />

      {STAR_POS.map(([lx, ty], i) => (
        <View
          key={i}
          style={[
            styles.star,
            { left: `${lx}%` as `${number}%`, top: `${ty}%` as `${number}%` },
          ]}
        />
      ))}

      <View style={styles.center}>
        <View style={styles.ringStage}>
          <Animated.View
            style={[
              styles.ringOuter,
              { transform: [{ rotate: rotA }] },
            ]}
          >
            <LinearGradient
              colors={[...neoGradientPrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ringGrad}
            >
              <View style={styles.ringInner} />
            </LinearGradient>
          </Animated.View>

          <Animated.View
            style={[
              styles.ringMid,
              { transform: [{ rotate: rotB }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(0,242,255,0.5)", "rgba(188,0,255,0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ringGradSm}
            >
              <View style={styles.ringInnerSm} />
            </LinearGradient>
          </Animated.View>

          <View style={styles.neoWrap}>
            <Image
              source={LOGO}
              style={styles.logoImg}
              resizeMode="contain"
              accessibilityLabel="Neo logo"
            />
          </View>
        </View>

        <Text style={styles.tag}>{SPLASH.tagline}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.loading}>{SPLASH.loadingLabel}</Text>
        <View style={styles.barBg}>
          <LinearGradient
            colors={["#00f2ff", "#00d4ff", "#bc00ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${progress}%` }]}
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

      <LinearGradient
        colors={["transparent", "rgba(157,80,187,0.12)", "rgba(0,212,255,0.08)"]}
        style={styles.bottomWave}
        pointerEvents="none"
      />
    </View>
  );
}

const RING = 280;
const PAD = 3;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050a18",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  star: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
    shadowColor: NEO.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  ringStage: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    width: RING,
    height: RING,
  },
  ringGrad: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    padding: PAD,
  },
  ringInner: {
    flex: 1,
    borderRadius: RING / 2 - PAD,
    backgroundColor: "#050a18",
  },
  ringMid: {
    position: "absolute",
    width: RING - 36,
    height: RING - 36,
  },
  ringGradSm: {
    width: RING - 36,
    height: RING - 36,
    borderRadius: (RING - 36) / 2,
    padding: 2,
    opacity: 0.75,
  },
  ringInnerSm: {
    flex: 1,
    borderRadius: (RING - 36) / 2 - 2,
    backgroundColor: "#050a18",
  },
  neoWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  logoImg: {
    width: 112,
    height: 112,
    shadowColor: NEO.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  tag: {
    marginTop: 20,
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  footer: {
    width: "100%",
    maxWidth: 360,
    gap: 14,
    alignItems: "center",
  },
  loading: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    letterSpacing: 1.5,
    textAlign: "center",
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
    minWidth: 4,
    shadowColor: "#00f2ff",
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 4,
  },
  start: {
    color: "#00f2ff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  authRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  authLink: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "700",
  },
  authDot: { color: "rgba(255,255,255,0.35)", fontSize: 14 },
  skip: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
  },
  bottomWave: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
});
