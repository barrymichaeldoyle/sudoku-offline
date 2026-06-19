import LottieView from "lottie-react-native";
import { StyleSheet } from "react-native";

import confetti from "@/assets/lottie/confetti.json";
import { View } from "@/tw";

/** Full-screen confetti celebration. Remount to replay. */
export function ConfettiBurst() {
  return (
    <View pointerEvents="none" className="absolute inset-0 z-50">
      <LottieView
        source={confetti}
        autoPlay
        loop={false}
        speed={2}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
