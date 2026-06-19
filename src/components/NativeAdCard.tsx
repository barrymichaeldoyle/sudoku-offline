import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { Image } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from "react-native-google-mobile-ads";

import { ENTITLEMENT_REMOVE_ADS } from "@/domain/entitlements";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { Text, View } from "@/tw";

// Test native unit ID — swap for the real per-platform unit once the AdMob app
// exists (e.g. via Platform.select). Requested non-personalized per the app's
// ad policy (no ATT prompt). See src/services/adService.ts and docs/retention-monetization.md.
const NATIVE_AD_UNIT_ID = TestIds.NATIVE;

/**
 * A non-intrusive native ad styled to match the app, for non-gameplay surfaces
 * (e.g. the success screen). Renders nothing for premium ("Remove Ads") users,
 * on web (no SDK — see NativeAdCard.web.tsx), or until an ad has loaded, so it
 * can be dropped in unconditionally.
 */
export function NativeAdCard({ className }: { className?: string }) {
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    if (isPremium) {
      return;
    }
    let cancelled = false;
    NativeAd.createForAdRequest(NATIVE_AD_UNIT_ID, { requestNonPersonalizedAdsOnly: true })
      .then((ad) => {
        if (cancelled) {
          ad.destroy();
          return;
        }
        setNativeAd(ad);
      })
      .catch(() => {
        // No fill / offline — show nothing.
      });
    return () => {
      cancelled = true;
    };
  }, [isPremium]);

  // Free the native resources when the ad changes or the card unmounts.
  useEffect(() => {
    if (!nativeAd) {
      return;
    }
    return () => nativeAd.destroy();
  }, [nativeAd]);

  if (isPremium || !nativeAd) {
    return null;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={{ width: "100%" }}>
      <View
        className={clsx("border-line bg-surface-muted gap-2 rounded-2xl border p-3", className)}
      >
        <Text className="text-ink-soft text-xs font-semibold uppercase">Sponsored</Text>
        <View className="flex-row items-center gap-3">
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={{ width: 36, height: 36, borderRadius: 8 }}
              />
            </NativeAsset>
          ) : null}
          <View className="flex-1">
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text className="text-ink font-semibold" numberOfLines={1}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text className="text-ink-soft text-sm" numberOfLines={2}>
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>
        <NativeMediaView
          style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 8 }}
          resizeMode="cover"
        />
        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            {/* Outline style so the ad's CTA reads as the ad's button, distinct
                from the app's solid-primary primary actions (e.g. Share). */}
            <Text className="border-primary text-primary rounded-xl border py-2 text-center font-semibold">
              {nativeAd.callToAction}
            </Text>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}
