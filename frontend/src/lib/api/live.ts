import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { withoutZone, withPlanFields, withUpdatedZone, withZone } from "./edits";
import type { PlanClientEvents, PlanServerEvents } from "./events";
import { planKey } from "./plans";
import type { PlanResponse } from "./types";

export type LiveState = "connecting" | "live" | "lost";

// Keeps a plan's cache current with what others save, for as long as the
// component is mounted. REST stays the source of truth: whatever an event
// cannot settle, and whatever was missed while the socket was away, is
// refetched. One socket per mounted hook, so there is nothing to leave when
// navigating; Socket.IO reconnects it by itself.
export function usePlanLive(planId: string): LiveState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");

  useEffect(() => {
    const key = planKey(planId);
    const refetch = () => void queryClient.invalidateQueries({ queryKey: key });
    const patch = (update: (plan: PlanResponse) => PlanResponse) => {
      queryClient.setQueryData<PlanResponse>(key, (plan) => plan && update(plan));
      // A GET that started before this change could answer after it, with
      // older data. Refetching cancels that request and starts a new one.
      if (queryClient.isFetching({ queryKey: key }) > 0) refetch();
    };

    const socket: Socket<PlanServerEvents, PlanClientEvents> = io("/plans", {
      path: "/api/socket.io",
      forceNew: true,
    });

    socket.on("connect", () => {
      socket.emit("join", { planId }, ({ ok }) => {
        if (!ok) return;
        setState("live");
        // Whatever was saved before the room was joined came through no event
        refetch();
      });
    });
    socket.on("disconnect", () => setState("lost"));
    socket.on("connect_error", () => setState("lost"));

    socket.on("zone.created", ({ zone }) => patch((plan) => withZone(plan, zone)));
    socket.on("zone.updated", ({ zone }) => {
      const plan = queryClient.getQueryData<PlanResponse>(key);
      // A zone this client has not heard of: its creation was missed
      if (plan && !plan.zones.some((item) => item.id === zone.id)) refetch();
      else patch((current) => withUpdatedZone(current, zone));
    });
    socket.on("zone.deleted", ({ zoneId }) => patch((plan) => withoutZone(plan, zoneId)));
    socket.on("plan.updated", ({ plan: fields }) => patch((plan) => withPlanFields(plan, fields)));
    // The data goes and the refetch answers 404, so each page shows its own
    // "not found"
    socket.on("plan.deleted", () => void queryClient.resetQueries({ queryKey: key }));

    return () => {
      socket.disconnect();
    };
  }, [planId, queryClient]);

  return state;
}
