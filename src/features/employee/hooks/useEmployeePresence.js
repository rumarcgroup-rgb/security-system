import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { EMPLOYEE_PRESENCE_HEARTBEAT_MS } from "../../../lib/presence";

export function useEmployeePresence(userId) {
  useEffect(() => {
    let cancelled = false;

    async function updatePresence() {
      if (cancelled) return;
      await supabase.from("employee_presence").upsert(
        {
          user_id: userId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    void updatePresence();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void updatePresence();
      }
    }, EMPLOYEE_PRESENCE_HEARTBEAT_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void updatePresence();
      }
    };

    window.addEventListener("focus", updatePresence);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updatePresence);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId]);
}
