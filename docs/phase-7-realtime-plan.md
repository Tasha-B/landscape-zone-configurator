# Phase 7 — Realtime: plan

Part of the [roadmap](phase-0-roadmap.md). The result is recorded in [phase-7-realtime.md](phase-7-realtime.md).

## Goal

Everyone viewing a plan sees saved changes without reloading. A zone moved in one editor moves in another editor and on the showcase. A viewer who loses the connection catches up when it returns.

REST stays the only way to write and the source of truth. The socket only reports changes that are already saved, so a client that misses an event recovers by refetching.

## Where we are

- The API has every write, with `version` and `409` on plans and zones ([phase-5-crud.md](phase-5-crud.md)). `ZonesService.remove()` uses `deleteMany`, so it does not learn the zone's plan, and an event needs it.
- The cache `["plan", id]` holds what the server confirmed, and the editor draws its pending changes on top ([phase-6-editor.md](phase-6-editor.md#data-layer)). An event can therefore change the cache without touching a change being saved.
- Three places assume that only this tab changes the plan:
  - **Answers overwrite the cache.** `withZone` takes any answer, so an answer that arrives after a newer event would bring old data back. `updatePlan`'s answer replaces every zone.
  - **`Field` replaces its text** whenever the saved value changes, which would wipe what someone is typing.
  - **A zone or plan that disappears.** The selection, a delete confirmation and a drag can point at a zone that is gone. A plan deleted elsewhere reads as "No connection", because a failed refetch keeps the data.
- The showcase already ignores selected zones that no longer exist.
- The page and the API share an origin through Vite's `/api` proxy. Phase 8 puts nginx in the same place.

## Decisions taken before the plan

*(Decided 2026-11-02.)*

1. **Both the editor and the showcase are live**, as the roadmap's "everyone viewing a plan" says. The plans list is not: it refetches when it is opened.
2. **Plans have events too.** The roadmap names only zone events, but a renamed or resized plan, or a deleted one, must also reach viewers. `plan.updated` and `plan.deleted` join them.
3. **The last save wins, field by field.** Events keep versions current, so most edits made after someone else's will now succeed instead of getting a `409`. Since a `PATCH` sends only the fields changed, a shape from one person and a color from another both survive; two changes to one field leave the later one. A `409` remains for true races. There are no locks.
4. **Only saved changes travel.** A drag shows to others when it is released, not while it moves. Showing drags live, and showing who else is viewing, is out of scope.
5. **Connection state shows in the editor only.** After a lost connection its status line says live updates are paused. The showcase stays silent.

## Protocol

Socket.IO, namespace `/plans`, path `/api/socket.io`.

The path is not Socket.IO's default, so that everything the app needs stays under `/api`: Vite's proxy (with `ws: true` added) and phase 8's nginx forward one prefix. Nest's global prefix does not apply to gateways, so the gateway sets the path itself.

Client to server:

| Event | Body | Acknowledgement |
| --- | --- | --- |
| `join` | `{ planId }` | `{ ok: true }`, or `{ ok: false }` when `planId` is not a UUID |

A socket watches one plan: `join` leaves the room it was in, which also bounds what one connection can hold. The plan's existence is not checked, because an empty room costs nothing and the client's `GET` reports a missing plan. Leaving is disconnecting.

Server to room `plan:<id>`:

| Event | Body | Sent after |
| --- | --- | --- |
| `zone.created` | `{ planId, zone }` | `POST /api/plans/:id/zones` |
| `zone.updated` | `{ planId, zone }` | `PATCH /api/zones/:id` |
| `zone.deleted` | `{ planId, zoneId }` | `DELETE /api/zones/:id` |
| `plan.updated` | `{ planId, plan }` | `PATCH /api/plans/:id` |
| `plan.deleted` | `{ planId }` | `DELETE /api/plans/:id` |

- **`zone` is the REST answer.** It is the same `ZoneResponse`, so the event types come from the generated ones, and an e2e test compares the two.
- **`plan` is the REST answer without `zones`.** Zone changes have their own events, and a list read earlier could be older than them.
- **Everyone in the room gets every event, the sender too.** Applying an event is idempotent (see below), so no client id has to travel with each request.
- **OpenAPI does not change**, which CI's existing check confirms.

## Backend

```
backend/src/realtime/
├── realtime.module.ts          exports the gateway
└── plan-events.gateway.ts      join, and one method per event
```

- **The services emit, after the write succeeded and outside the transaction.** A rejected write (`400`, `404`, `409`) emits nothing. `PlansModule` and `ZonesModule` import `RealtimeModule`.
- **`ZonesService.remove()`** reads the plan id with `delete` + `select: { planId: true }`, and `P2025` still means `404` (`isRecordNotFound`).
- **`join` checks its own input.** A gateway's payload does not come through the HTTP validation, so the handler calls `isUUID` and copes with any body; a malformed one gets `{ ok: false }`, not a crash.
- **One API instance.** Rooms live in its memory. Several instances would need the Redis adapter, which is not needed for the deployment planned in phase 9.
- **New dependencies:** `@nestjs/websockets` and `@nestjs/platform-socket.io` 12.3 (matching `@nestjs/core`), which bring `socket.io` 4.8; for tests, `socket.io-client` 4.8.

## Frontend

### The cache only moves forward

Answers and events can arrive in any order: an event often overtakes the answer to its own request. One rule in `lib/api/edits.ts` covers both:

| Arrives | Effect on the cached plan |
| --- | --- |
| a zone, created | added, unless the id is known (then as updated) |
| a zone, updated | replaces the zone if its `version` is higher or equal; an older one is ignored |
| a zone update, unknown id | an answer is ignored, since the zone was deleted meanwhile; an event triggers a refetch |
| a zone deleted | removed; nothing happens if it is already gone |
| plan fields | taken if their `version` is higher or equal, and the zones stay |
| anything, while no plan is cached | ignored; the running request brings it |

`updatePlan`'s answer changes from replacing the plan to taking its fields, so its older zone list cannot undo a newer event.

### A refetch can be older than an event

A `GET` that started before a write can answer after its event and put old data back. So when an event arrives while the plan is being fetched, it is applied and the plan is invalidated, which cancels that request and starts a new one (`cancelRefetch`).

### `usePlanLive(planId)`

`lib/api/live.ts`; used by `SpaceMapper` and `PlanEditor`. Returns `"connecting" | "live" | "lost"`.

- **One socket per mounted hook**, created in an effect and disconnected in its cleanup. There is nothing to leave when navigating, and React's double mount in development is harmless.
- **On every `connect`** it sends `join`; on the acknowledgement it invalidates the plan. This closes the gap between reading the plan and joining the room, and catches up after a lost connection. It costs one extra `GET` per page open.
- **`plan.deleted`** calls `resetQueries`: the data is dropped, the refetch answers `404`, and each page shows its existing "not found" state.
- **Sockets reconnect by themselves** (Socket.IO's backoff). `refetchOnWindowFocus` stays as a further safety net.

### The editor under live changes

- **A field being edited keeps its text.** `Field` follows a new saved value only if the person has not typed anything. Otherwise the text stays, and leaving the field saves it (decision 3). A field focused but untouched follows the value and saves nothing, so tabbing through cannot undo someone else's change.
- **A dragged zone** keeps its draft until it is released, and the release saves it (decision 3). If the zone was deleted meanwhile, the drag ends and no request is sent.
- **A selected zone that disappears** clears the selection and any delete confirmation, and the status line says "This zone was deleted elsewhere." The focus moves to the toolbar instead of being lost. A `409` reload that removes the zone takes the same path.
- **A deleted plan.** A `404` shows the "not found" state even with a plan on screen, also when a refetch finds it out without an event. It no longer reads as "No connection".
- **The status line** adds "Live updates are paused. Reconnecting…" while `usePlanLive` says `lost`. Everything else takes priority over it, and "No connection to the server" replaces it.

## Code layout

```
backend/src/realtime/                  the gateway and its module
frontend/src/lib/api/
├── edits.ts                           the forward-only rule
├── events.ts                          event names and bodies, from the generated types
└── live.ts                            usePlanLive
```

## Tests

- **Backend e2e (`realtime.e2e-spec.ts`):** a real server (`app.listen(0)`) and real `socket.io-client` sockets. It covers:
  - `join` with a valid id, an invalid id and a malformed body;
  - each of the five events, its body equal to the REST answer;
  - nothing sent to another plan's room, or after leaving by a second `join`;
  - nothing sent for a rejected write (`400`, `404`, `409`). To avoid sleeping, the test makes a valid write afterwards and checks that its event is the first to arrive.
- **Frontend unit (`edits.test.ts`, `live.test.ts`):** every row of the table above; an old answer after a newer event; an event during a fetch invalidating; a join acknowledgement invalidating; `plan.deleted` resetting. The socket is a fake that the test drives.
- **Components (`PlanEditor.test.tsx`, `PlanEditorPanels.test.tsx`):**
  - another viewer's change shows, with a pending change of this tab still on top;
  - the next edit sends the version that came through the event;
  - a typed field keeps its text, and an untouched focused field follows the value and sends nothing;
  - a selected zone deleted elsewhere clears the selection, with the message;
  - a drag on a zone deleted elsewhere sends nothing;
  - a deleted plan shows "not found";
  - the paused message comes and goes.
- **Mutation checks,** as in phase 6: no version guard, an answer replacing zones, no invalidation after join, no invalidation during a fetch, an event sent before the write, and a rejected write that emits.
- **In the browser:** two tabs through headless Edge, with real events:
  1. Drag, resize, add and delete in one; the other follows, and the showcase in a third follows too.
  2. Edit different fields of one zone at once; both survive.
  3. Delete a selected zone, then the plan, from the other tab.
  4. Stop the API, change a zone directly in the database, and start the API again; the open tab shows the change once it reconnects.
- **The showcase without events:** the 18 screenshots against `main`, as in phases 4–6. A marker redraw when a zone changes live is checked by hand.

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Plan.** This document. Tick the last acceptance box of phase 6 (both CI jobs were green on PR #8).
2. **Gateway.** The dependencies, `join`, the five events from the services, e2e tests. Checks against Nest 12's docs how a gateway boots under ESM and that `write-openapi` still runs without a server.
3. **Forward-only cache.** The rule in `edits.ts` and its use for answers, with unit tests. Nothing visible changes yet.
4. **Live plans.** `socket.io-client`, the Vite proxy, `events.ts`, `usePlanLive`, on both pages, with tests.
5. **The editor under live changes.** `Field`, a dragged zone, a vanished selection, a deleted plan, the status line and its translations, with component tests.
6. **Docs.** `phase-7-realtime.md`, the roadmap (the protocol, including the plan events), the README (trying it in two tabs).

## Acceptance criteria

- [x] A zone created, changed or deleted in one tab shows in other tabs on the same plan, in the editor and on the showcase, without a reload.
- [x] A plan renamed or resized in one tab shows in others; a plan deleted in one shows "not found" in others. *(The showcase shows its error state: see the deviations in [phase-7-realtime.md](phase-7-realtime.md#deviations-from-the-plan).)*
- [x] Other plans' viewers receive nothing, and a rejected write sends no event.
- [x] A pending change stays on screen when an event arrives; an answer never brings older data back.
- [x] Text being typed is not replaced by another viewer's change.
- [x] After a lost connection, the plan is current again once it returns, without a reload.
- [x] `/` looks and works as after phase 6: screenshots are byte-identical with no events.
- [x] `backend/openapi.json` is unchanged.
- [ ] Both CI jobs are green.

## Out of scope

- Live drags, cursors, presence and zone locks (decision 4).
- A live plans list (decision 1).
- Merging two changes to one field, and highlighting what someone else changed.
- Several API instances (the Redis adapter).
- Checking the socket's `Origin`, and permissions: without auth, the socket is as open as the REST API. Phases 9 and 10 settle this along with [open question 1](phase-0-roadmap.md#open-questions).
- Selecting several zones and Bézier edges ([later list](phase-0-roadmap.md#later)).
