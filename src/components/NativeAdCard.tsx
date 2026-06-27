import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { NATIVE_AD_UNIT_IDS } from "@/domain/adUnits";
import { ENTITLEMENT_REMOVE_ADS } from "@/domain/entitlements";
import { adService } from "@/services/adService";
import { useEntitlementStore } from "@/state/useEntitlementStore";
import { Text, View } from "@/tw";

/**
 * A non-intrusive native ad styled to match the app, for non-gameplay surfaces
 * (e.g. the success screen, the Stats page). Renders nothing for premium
 * ("Remove Ads") users, on web (no SDK — see NativeAdCard.web.tsx), or until an
 * ad has loaded, so it can be dropped in unconditionally. Pass `unitId` to pick
 * the placement's AdMob unit (see NATIVE_AD_UNIT_IDS); defaults to completion.
 */
export function NativeAdCard({
  className,
  unitId = NATIVE_AD_UNIT_IDS.completion,
}: {
  className?: string;
  unitId?: string;
}) {
  const isPremium = useEntitlementStore((s) => s.entitlements[ENTITLEMENT_REMOVE_ADS] === true);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    if (isPremium) {
      return;
    }
    // Prefer the ad prefetched at boot so the card paints instantly; the service
    // hands off ownership (we destroy it on unmount) and warms a replacement.
    const prefetched = adService.takeNativeAd(unitId);
    if (prefetched) {
      setNativeAd(prefetched);
      return;
    }
    // Nothing warmed yet (e.g. taken before boot prefetch landed) — request one.
    let cancelled = false;
    NativeAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true })
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
  }, [isPremium, unitId]);

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
        {/* Fixed-aspect frame so the media can't dominate or overflow the card.
            NativeMediaView sizes to the creative's own ratio, so we pin it to the
            frame with absoluteFill and use "contain" to show the whole creative
            (no cropping/cut-off). */}
        <View className="bg-surface overflow-hidden rounded-lg" style={{ aspectRatio: 16 / 9 }}>
          <NativeMediaView style={StyleSheet.absoluteFill} resizeMode="contain" />
        </View>
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
