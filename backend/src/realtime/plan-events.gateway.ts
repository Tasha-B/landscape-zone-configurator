import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { isUUID } from "class-validator";
import type { Namespace, Socket } from "socket.io";
import type { PlanResponse } from "../plans/plan.response.js";
import type { ZoneResponse } from "../zones/zone.response.js";

const PLAN_ROOM_PREFIX = "plan:";
const planRoom = (planId: string) => `${PLAN_ROOM_PREFIX}${planId}`;

// Tells everyone viewing a plan about changes that are already saved. REST
// stays the only way to write, so a client that misses an event recovers by
// refetching. Everyone in the room gets every event, the sender too.
//
// Under /api, so that a proxy forwards one prefix; Nest's global prefix does
// not apply to gateways.
@WebSocketGateway({ namespace: "/plans", path: "/api/socket.io" })
export class PlanEventsGateway {
  @WebSocketServer()
  private readonly namespace!: Namespace;

  // A socket watches one plan, so joining another leaves the room it was in.
  // Payloads do not pass the HTTP validation and can be anything. The plan's
  // existence is not checked: an empty room costs nothing, and the client's
  // GET reports a missing plan.
  @SubscribeMessage("join")
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    const planId = (body as { planId?: unknown } | null | undefined)?.planId;
    if (typeof planId !== "string" || !isUUID(planId)) return { ok: false };
    for (const room of socket.rooms) {
      if (room.startsWith(PLAN_ROOM_PREFIX)) await socket.leave(room);
    }
    await socket.join(planRoom(planId));
    return { ok: true };
  }

  zoneCreated(planId: string, zone: ZoneResponse): void {
    this.namespace.to(planRoom(planId)).emit("zone.created", { planId, zone });
  }

  zoneUpdated(planId: string, zone: ZoneResponse): void {
    this.namespace.to(planRoom(planId)).emit("zone.updated", { planId, zone });
  }

  zoneDeleted(planId: string, zoneId: string): void {
    this.namespace.to(planRoom(planId)).emit("zone.deleted", { planId, zoneId });
  }

  // Without the zones: they have their own events, and a list read earlier
  // could be older than those
  planUpdated(response: PlanResponse): void {
    const { zones: _zones, ...plan } = response;
    this.namespace.to(planRoom(plan.id)).emit("plan.updated", { planId: plan.id, plan });
  }

  planDeleted(planId: string): void {
    this.namespace.to(planRoom(planId)).emit("plan.deleted", { planId });
  }
}
