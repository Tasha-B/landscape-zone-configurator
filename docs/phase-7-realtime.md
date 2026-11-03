# Phase 7 — Realtime

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-7-realtime-plan.md](phase-7-realtime-plan.md).

Everyone viewing a plan sees saved changes without reloading. A zone moved in one editor moves in another editor and on the showcase. A viewer who loses the connection catches up when it returns.

REST stays the only way to write and the source of truth. The socket only reports changes that are already saved, so a client that misses an event recovers by refetching. `backend/openapi.json` did not change.

The showcase with no events is unchanged: its screenshots are byte-identical to `main` (see [Checks](#checks)).

## Protocol

Socket.IO, namespace `/plans`, path `/api/socket.io`. Everything the app needs stays under `/api`, so Vite's proxy (with `ws: true`) and phase 8's nginx forward one prefix.

Client to server:

| Event | Body | Acknowledgement |
| --- | --- | --- |
| `join` | `{ planId }` | `{ ok: true }`, or `{ ok: false }` when `planId` is not a UUID or the body is malformed |

A socket watches one plan: `join` leaves the room it was in. Leaving is disconnecting. The plan's existence is not checked, because an empty room costs nothing and the client's `GET` reports a missing plan.

Server to room `plan:<id>`:

| Event | Body | Sent after |
| --- | --- | --- |
| `zone.created` | `{ planId, zone }` | `POST /api/plans/:id/zones` |
| `zone.updated` | `{ planId, zone }` | `PATCH /api/zones/:id` |
| `zone.deleted` | `{ planId, zoneId }` | `DELETE /api/zones/:id` |
| `plan.updated` | `{ planId, plan }` | `PATCH /api/plans/:id` |
| `plan.deleted` | `{ planId }` | `DELETE /api/plans/:id` |

- **`zone` is the REST answer**, and **`plan` is the REST answer without `zones`.** The frontend's event types (`lib/api/events.ts`) therefore come from the generated ones.
- **Everyone in the room gets every event, the sender too.** Applying an event is idempotent, so no client id travels with a request.
- **Deleting a plan sends only `plan.deleted`,** not one event per zone.

## Backend

```
backend/src/realtime/
├── realtime.module.ts          exports the gateway
└── plan-events.gateway.ts      join, and one method per event
```

- **The services emit, after the write succeeded and outside the transaction.** A rejected write (`400`, `404`, `409`) emits nothing.
- **`ZonesService.remove()`** now reads the plan id with `delete` + `select: { planId: true }`, since an event needs the plan. A missing zone is still a `404`.
- **`join` checks its own input.** A gateway's payload does not pass the HTTP validation and can be anything.
- **One API instance.** Rooms live in its memory; several instances would need the Redis adapter.

**New dependencies:** `@nestjs/websockets` and `@nestjs/platform-socket.io` 12.3, which bring `socket.io` 4.8; for tests, `socket.io-client` 4.8.

## Frontend

### The cache only moves forward

Answers and events can arrive in any order: an event often overtakes the answer to its own request. One set of rules in `lib/api/edits.ts` covers both:

| Arrives | Effect on the cached plan |
| --- | --- |
| a zone, created | added, unless the id is known (then as updated) |
| a zone, updated | replaces the zone if its `version` is higher or equal; an older one is ignored |
| a zone update, unknown id | an answer is ignored, since the zone was deleted meanwhile; an event triggers a refetch |
| a zone deleted | removed; nothing happens if it is already gone |
| plan fields | taken if their `version` is higher or equal, and the zones stay |
| anything, while no plan is cached | ignored; the running request brings it |

The answer to a plan's `PATCH` used to replace the whole plan. It now gives only the plan's fields, so its older zone list cannot undo a newer event.

### `usePlanLive(planId)`

`lib/api/live.ts`, used by `SpaceMapper` and `PlanEditor`. It returns `"connecting" | "live" | "lost"`.

- **One socket per mounted hook,** created in an effect and disconnected in its cleanup, so there is nothing to leave when navigating. Socket.IO reconnects it by itself.
- **On every `connect`** it sends `join`, and on the acknowledgement it refetches the plan. This closes the gap between reading the plan and joining the room, and catches up after a lost connection. It costs one extra `GET` per page open.
- **An event during a fetch** is applied and the plan is invalidated, which cancels that `GET` and starts a new one. A `GET` that started before a write could otherwise answer after its event, with older data.
- **`plan.deleted`** calls `resetQueries`: the data goes, the refetch answers `404`, and each page shows its own error state.

### The editor under live changes

- **A field keeps typed text.** `Field` follows a new saved value only if the person has not typed anything. Typed text stays, and leaving the field saves it (the last save wins). A field focused but untouched follows the value and saves nothing, so tabbing through cannot undo someone else's change.
- **A dragged zone** stays under the pointer, and the release saves it. If the zone was deleted meanwhile, the drag ends and no request is sent.
- **A selected zone that disappears** clears the selection and any delete confirmation, and the status line says so. A focus that went with it moves to the toolbar; a focus elsewhere stays where it is.
- **A deleted plan.** A `404` shows "not found" even with a plan on screen, also when a refetch finds it out without an event. It no longer reads as "No connection".

The status line has two new messages, and what holds now comes before what happened last:

1. "Saving…"
2. "No connection to the server…"
3. **"Live updates are paused. Reconnecting…"** (new)
4. "This plan was changed elsewhere…", "Could not save…", **"This zone was deleted elsewhere."** (new)
5. "All changes saved"

## Code layout

```
backend/src/realtime/                  the gateway and its module
frontend/src/
├── lib/api/
│   ├── edits.ts                       the forward-only rules, over the pending edits
│   ├── events.ts                      event names and bodies, from the generated types
│   ├── live.ts                        usePlanLive
│   └── fakeSocket.ts                  a socket the tests drive (test support)
└── components/PlanEditor/             Field, EditorCanvas, EditorToolbar and PlanEditor under live changes
```

**New frontend dependency:** `socket.io-client` 4.8.

## Checks

| Suite | Covers |
| --- | --- |
| `backend/test/realtime.e2e-spec.ts` (20) | a real server and real sockets: `join` with a valid id, an invalid id and no body; each event, its body equal to the REST answer; several viewers; the order of changes; other rooms, no join and a second `join`; nothing after a rejected write |
| `lib/api/edits.test.ts` (19) | every row of the rules above, and the pending edits as before |
| `lib/api/mutations.test.tsx` (11) | an older answer does not undo a newer zone, bring back a deleted zone or replace zones |
| `lib/api/live.test.tsx` (16) | the connection, a refused join, catching up, each event, an event during a fetch |
| `components/PlanEditor/PlanEditorLive.test.tsx` (26) | the canvas, fields, a vanished selection and the focus, a deleted plan, the connection and the status line |

Totals: frontend 235 (178 after phase 6); backend 43 unit, 62 e2e (42 e2e after phase 6).

**Mutation checks**, each failing at least one test:

- the gateway: no UUID check, `join` not leaving the last room, `plan.updated` with zones, `zone.created` sent to everyone, `plan.deleted` sent on a `404`, no `zone.deleted`;
- the cache (six in all), among them no version check and an answer replacing the plan's zones;
- `usePlanLive`: no refetch during a fetch or after a join, a refused join taken as joined, an unknown zone not refetched, `plan.deleted` only invalidating, a disconnect not reported, no disconnect on unmount;
- the editor: a field always or never following, a drag of a deleted zone saving, no message about a deleted zone, a `404` with data on screen not shown, no paused message, the focus never or always moved, no keys on the toolbar's two forms, the focus taken when the editor opens.

**In the browser.** Headless Edge with real mouse and keyboard events through the DevTools protocol, the built API, Vite's proxy, and test plans created and deleted through the API:

- two editors and the showcase: a drag and a resize with the mouse in one editor, "+ Rectangle" and "Delete zone" there, a rename in its panel and a resize of the sheet. The other editor and the showcase followed each one, the showcase also with the zone selected, and no page reloaded;
- on the showcase, the moved and resized zone's markers were redrawn in place and its area caption changed from about 15 to about 29 m²;
- a shape from one tab and a color from the other both survive;
- text being typed stays while another viewer's name for the zone shows on the canvas, and leaving the field saves it;
- a selected zone deleted elsewhere gives the message, the focus on "+ Rectangle" and no write;
- the plan deleted on the plans page of another tab: "not found" in the editor, the error state on the showcase, no write from the editor;
- the API stopped: the paused message. A zone changed directly in the database meanwhile showed once the API was back.

**The showcase.** The 18 screenshots of phases 4–6, from `main` and from the branch, in turns, twice each: 18 of 18 identical in every pairing.

## Findings

- **A hover screenshot can catch the tint being painted.** With the 400 ms wait of earlier phases, one of the 18 differed stably from `main`: the open floor's tint was paler. The computed `fill` was the same throughout, the shot varied within one version too, and with 2.5 s of waiting it matched byte for byte. The script now waits for hover shots.
- **`useQuery` reads the cache when it renders.** A new zone looked likely to count as deleted for the moment between selecting it and the plan showing it, so it got a guard. A mutation check showed the guard did nothing, also with notifications delayed by 20 ms: the zone is in the cache before it is selected. The guard is gone and the test stays.
- **React reused a focused button, a bug from phase 6.** The toolbar's "Cancel" and "+ Polygon" were the same DOM node, so closing a delete confirmation left the focus on "+ Polygon" with `tabindex="-1"`, and `Enter` would have added a polygon. The two forms now have their own `key`s. After "Cancel" the focus goes back to "Delete zone", after deleting to the toolbar's first button.
- **A past message hid the present one.** "This zone was deleted elsewhere." kept "Live updates are paused" from showing until the next change. A browser run found this, not the tests; it now has a test.
- **Viewers of a deleted plan see "Loading" for a moment, by design.** `resetQueries` drops the data before the `404` arrives. Over 12 rounds with one visible and one hidden tab, the message showed within 78 ms at most. One early run still showed "Loading" 500 ms after the event, with no `404` logged. It did not come back in any later run, and its cause is unknown. It was one of the first runs after adding the socket client, so Vite's dependency step may be involved, which is unconfirmed.
- **Tests must wait a tick after an event.** TanStack Query notifies through `setTimeout(0)`, so the screen changes just after the cache does.
- **The bundle passed Vite's 500 kB warning.** The socket client took it from 474 to 517 kB (gzip 150 to 163). It works as it is; splitting it can wait for phase 8.

## Deviations from the plan

- **The paused message outranks past messages.** The plan had everything else take priority over it (see [Findings](#findings)).
- **The showcase says "The plan could not be loaded" for a deleted plan,** with "Try again". The plan's criterion said "not found", but the showcase has no such state, and it was left as it is.
- **"An event sent before the write"** was checked as `plan.deleted` sent for a missing plan. A successful write whose event went out early was not tried.
- **Tests live in new files** (`PlanEditorLive.test.tsx`, `fakeSocket.ts`), not in the two named by the plan.
- **The toolbar's focus bug from phase 6** was fixed here, since the new focus handling depends on it.

## Known gaps

- **Several API instances** would need the Redis adapter.
- **The socket's `Origin` is not checked, and there are no permissions.** Anyone who reaches the API can follow a plan by its id, as they can read it over REST (roadmap open question 2).
- **The last save wins for a whole field.** Text being typed or a zone being dragged overwrites a change that arrived meanwhile, with no warning.
- **A text change sends all four texts of the language,** taken from the screen when the change is made. A change to another text that arrives before it is sent can be overwritten. Other fields are not affected.
- **Text typed in the panel of a zone deleted elsewhere is lost** with the panel; the status line says the zone was deleted.
- **The plans list is not live,** and **the showcase does not say when its connection is lost** (decisions 1 and 5).
- **The demo office and the first-load `GET`:** the demo office stays editable by anyone (open question 1), and each page open fetches the plan twice, once to load and once after joining.
