import type { NotificationResponse } from "expo-notifications";

import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";

import { track } from "@/services/analyticsService";
import {
  addNotificationTapListener,
  getLastNotificationResponseAsync,
} from "@/services/notificationService";

// Only the very first response per app process is a genuine cold-start tap;
// `getLastNotificationResponseAsync` keeps returning it, so guard against
// re-routing on later mounts.
let coldStartHandled = false;

/**
 * Route to the daily puzzle when the app is opened or resumed from a reminder
 * tap. Mount once inside the navigator (see `app/_layout.tsx`). Kept out of
 * `notificationService` so that module stays free of `expo-router`, which lets
 * the stores import it without pulling navigation into non-UI code (and tests).
 */
export function useDailyReminderObserver(): void {
  const router = useRouter();

  useEffect(() => {
    const routeFrom = (response: NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === "string") {
        void track("daily_reminder_tapped");
        router.push(url as Href);
      }
    };

    if (!coldStartHandled) {
      coldStartHandled = true;
      void getLastNotificationResponseAsync().then(routeFrom);
    }

    return addNotificationTapListener(routeFrom);
  }, [router]);
}
