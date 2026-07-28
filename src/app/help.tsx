import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Pressable, ScrollView, Text, View } from "@/tw";

const SUPPORT_URL = "https://barrymichaeldoyle.github.io/sudoku-offline/support.html";
const PRIVACY_URL = "https://barrymichaeldoyle.github.io/sudoku-offline/privacy.html";

const PLAY_GUIDE = [
  {
    title: "Fill the grid",
    body: "Every row, column, and 3×3 box must contain the numbers 1–9 exactly once.",
  },
  {
    title: "Use notes",
    body: "Turn on Notes to pencil possible numbers into an empty cell. Notes never count as answers.",
  },
  {
    title: "Choose your input style",
    body: "Cell-first selects a square before a number. Number-first selects a number before one or more squares.",
  },
  {
    title: "Hints and mistakes",
    body: "Hints reveal one correct cell. Mistake checking and the mistake counter can be adjusted independently in Settings.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "Unknown";

  const open = async (url: string) => {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    }
  };

  return (
    <Screen className="bg-canvas flex-1">
      <ScreenHeader title="Help & About" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-6"
      >
        <View className="w-full max-w-[640px] gap-7 self-center">
          <View className="gap-3">
            <SectionLabel>How to Play</SectionLabel>
            {PLAY_GUIDE.map((item) => (
              <View
                key={item.title}
                className="border-line bg-surface gap-1 rounded-2xl border px-4 py-3"
              >
                <Text className="text-ink text-base font-medium">{item.title}</Text>
                <Text className="text-ink-soft text-sm">{item.body}</Text>
              </View>
            ))}
          </View>

          <View className="gap-3">
            <SectionLabel>Get Help</SectionLabel>
            <ExternalLink
              title="Support and FAQs"
              hint="Troubleshooting and ways to get in touch"
              onPress={() => void open(SUPPORT_URL)}
            />
            <ExternalLink
              title="Privacy Policy"
              hint="What the app stores and how it is used"
              onPress={() => void open(PRIVACY_URL)}
            />
          </View>

          <View className="gap-3">
            <SectionLabel>About</SectionLabel>
            <View className="border-line bg-surface gap-1 rounded-2xl border px-4 py-3">
              <Text className="text-ink text-base font-medium">Offline Sudoku</Text>
              <Text className="text-ink-soft text-sm">
                Core puzzles and progress stay available without an internet connection. No account
                is required.
              </Text>
              <Text selectable className="text-ink-dim pt-1 text-xs">
                Version {version}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-soft px-1 text-xs font-semibold tracking-widest uppercase">
      {children}
    </Text>
  );
}

function ExternalLink({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={title}
      accessibilityHint={hint}
      className="border-line bg-surface flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-70"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-ink text-base font-medium">{title}</Text>
        <Text className="text-ink-soft text-sm">{hint}</Text>
      </View>
      <Text className="text-ink-soft text-xl">↗</Text>
    </Pressable>
  );
}
