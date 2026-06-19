import { clsx } from "clsx";
import { useState } from "react";

import { SimpleIcon } from "@/components/SimpleIcon";
import { ENTITLEMENT_REMOVE_ADS } from "@/domain/entitlements";
import { track } from "@/services/analyticsService";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { Pressable, Text } from "@/tw";

/**
 * "Remove Ads" purchase entry point. Renders nothing once the entitlement is
 * owned, so callers can drop it in unconditionally. `source` is recorded on the
 * `premium_upgrade_tapped` analytics event so we can compare surfaces.
 *
 * `variant` controls presentation: "button" (default) is a full bordered CTA;
 * "link" is an understated text link for surfaces where the ad itself is the
 * pitch (e.g. directly under a native ad on the success screen).
 */
export function RemoveAdsButton({
  source,
  variant = "button",
}: {
  source: string;
  variant?: "button" | "link";
}) {
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);
  const purchaseRemoveAds = useEntitlementStore((s) => s.purchaseRemoveAds);
  const [busy, setBusy] = useState(false);

  if (isPremium) {
    return null;
  }

  const onPress = async () => {
    if (busy) {
      return;
    }
    void track("premium_upgrade_tapped", { source });
    setBusy(true);
    try {
      await purchaseRemoveAds();
    } finally {
      setBusy(false);
    }
  };

  if (variant === "link") {
    return (
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Remove ads and skip hint prompts"
        className={clsx("items-center py-1 active:opacity-60", busy && "opacity-50")}
      >
        <Text className="text-ink-soft text-sm font-medium underline">
          {busy ? "Loading…" : "Remove ads"}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Remove ads and skip hint prompts"
      className={clsx(
        "flex-row items-center justify-center gap-2 rounded-2xl border border-primary py-4 active:opacity-80",
        busy && "opacity-50",
      )}
    >
      <SimpleIcon name="plus" tone="primary" />
      <Text className="text-primary text-base font-semibold">
        {busy ? "Loading…" : "Remove Ads"}
      </Text>
    </Pressable>
  );
}
