import { clsx } from "clsx";
import { useRouter } from "expo-router";

import { AppMark } from "@/components/AppMark";
import { Screen } from "@/components/Screen";
import { useSettingsStore } from "@/state/useSettingsStore";
import { Pressable, ScrollView, Text, View } from "@/tw";

/**
 * First-launch landing screen: pick a minimal (distraction-free) or full
 * (all assists on) setup. The choice writes a settings preset and marks
 * onboarding complete, after which Home stops redirecting here.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const choose = (minimal: boolean) => {
    completeOnboarding(minimal);
    router.replace("/");
  };

  return (
    <Screen className="bg-canvas flex-1">
      <ScrollView contentContainerClassName="grow justify-center p-6">
        <View className="w-full max-w-[420px] gap-10 self-center">
          <View className="items-center gap-3">
            <AppMark size="lg" />
            <Text className="text-ink text-3xl font-bold">Welcome to Sudoku</Text>
            <View className="items-center gap-0">
              <Text className="text-ink-soft text-center text-base">
                How would you like to play?
              </Text>
              <Text className="text-ink-soft text-center text-base">
                You can change everything later in Settings.
              </Text>
            </View>
          </View>

          <View className="gap-3">
            <ChoiceCard
              title="Minimal"
              description="Just you and the grid. No timer, mistake checking, or highlights."
              onPress={() => choose(true)}
            />
            <ChoiceCard
              title="Full experience"
              description="Timer, mistake checking, and helpful highlights all switched on."
              onPress={() => choose(false)}
              primary
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ChoiceCard({
  title,
  description,
  primary,
  onPress,
}: {
  title: string;
  description: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={clsx(
        "gap-1 rounded-2xl border p-5 active:opacity-80",
        primary ? "border-primary bg-primary" : "border-line bg-surface",
      )}
    >
      <Text className={clsx("text-lg font-bold", primary ? "text-on-primary" : "text-ink")}>
        {title}
      </Text>
      <Text className={clsx("text-sm", primary ? "text-on-primary" : "text-ink-soft")}>
        {description}
      </Text>
    </Pressable>
  );
}
