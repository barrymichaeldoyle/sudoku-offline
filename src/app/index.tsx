import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/tw";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 items-center justify-center gap-2 bg-white p-6 dark:bg-neutral-900">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">Sudoku</Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">
          Tailwind is wired up.
        </Text>
      </View>
    </SafeAreaView>
  );
}
