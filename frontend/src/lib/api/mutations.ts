import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError } from "./client";
import { withEdits, withoutZone, withZone, type PlanEdit } from "./edits";
import {
  createPlan,
  createZone,
  deletePlan,
  deleteZone,
  planKey,
  PLANS_KEY,
  updatePlan,
  updateZone,
  usePlanResponse,
} from "./plans";
import type { CreateZoneBody, PlanChanges, PlanResponse, ZoneChanges } from "./types";

const editKey = (planId: string) => ["plan-edit", planId] as const;

// A 409: the plan or zone was changed elsewhere since the version sent
export type SaveErrorKind = "conflict" | "failed";

export function saveErrorKind(error: unknown): SaveErrorKind {
  return error instanceof ApiError && error.status === 409 ? "conflict" : "failed";
}

// The plan as the editor shows it: what the server confirmed, with the
// edits still pending on top (see edits.ts)
export function useEditedPlan(planId: string) {
  const query = usePlanResponse(planId);
  const pending = useMutationState({
    filters: { mutationKey: editKey(planId), status: "pending" },
    select: (mutation) => mutation.state.variables as PlanEdit,
  });
  const data = useMemo(() => query.data && withEdits(query.data, pending), [query.data, pending]);
  return { ...query, data, saving: pending.length > 0 };
}

interface PlanEditsOptions {
  // Called when a change could not be saved; the change is gone from the
  // screen by then, and the plan is being reloaded
  onSaveError?: (kind: SaveErrorKind, error: unknown) => void;
}

// Saving the editor's changes. All of a plan's changes share one scope, so
// they are sent one at a time in the order they were made, and each takes
// its version from the cache when it is sent, that is, after the answer to
// the one before. Two quick changes to a zone therefore send versions 1 and
// 2, not 1 twice.
export function usePlanEdits(planId: string, { onSaveError }: PlanEditsOptions = {}) {
  const queryClient = useQueryClient();
  const key = planKey(planId);

  const confirmed = (): PlanResponse => {
    const plan = queryClient.getQueryData<PlanResponse>(key);
    if (!plan) throw new Error(`Plan ${planId} is not loaded`);
    return plan;
  };
  const confirmedZone = (zoneId: string) => {
    const zone = confirmed().zones.find((item) => item.id === zoneId);
    if (!zone) throw new Error(`Zone ${zoneId} is not in plan ${planId}`);
    return zone;
  };
  const commit = (update: (plan: PlanResponse) => PlanResponse) => {
    queryClient.setQueryData<PlanResponse>(key, (plan) => plan && update(plan));
    // The list shows zone counts and the last change
    void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
  };

  const shared = {
    mutationKey: editKey(planId),
    scope: { id: `plan:${planId}` },
    // Reloading before the next queued change is sent gives that change the
    // current version. After a 409 the reload also shows what changed.
    onError: async (error: unknown) => {
      onSaveError?.(saveErrorKind(error), error);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  };

  const planMutation = useMutation({
    ...shared,
    mutationFn: (edit: Extract<PlanEdit, { kind: "updatePlan" }>) =>
      updatePlan(planId, { ...edit.changes, version: confirmed().version }),
    // Sent one at a time, so the answer is the server's whole plan as of now
    onSuccess: (plan: PlanResponse) => commit(() => plan),
  });

  const createMutation = useMutation({
    ...shared,
    mutationFn: (edit: Extract<PlanEdit, { kind: "createZone" }>) => createZone(planId, edit.body),
    onSuccess: (zone) => commit((plan) => withZone(plan, zone)),
  });

  const updateMutation = useMutation({
    ...shared,
    mutationFn: (edit: Extract<PlanEdit, { kind: "updateZone" }>) =>
      updateZone(edit.zoneId, { ...edit.changes, version: confirmedZone(edit.zoneId).version }),
    onSuccess: (zone) => commit((plan) => withZone(plan, zone)),
  });

  const deleteMutation = useMutation({
    ...shared,
    mutationFn: (edit: Extract<PlanEdit, { kind: "deleteZone" }>) => deleteZone(edit.zoneId),
    onSuccess: (_, edit) => commit((plan) => withoutZone(plan, edit.zoneId)),
  });

  return {
    updatePlan: (changes: PlanChanges) => planMutation.mutate({ kind: "updatePlan", changes }),
    // Resolves with the new zone, so the editor can select it
    createZone: (body: CreateZoneBody) => createMutation.mutateAsync({ kind: "createZone", body }),
    updateZone: (zoneId: string, changes: ZoneChanges) => updateMutation.mutate({ kind: "updateZone", zoneId, changes }),
    deleteZone: (zoneId: string) => deleteMutation.mutate({ kind: "deleteZone", zoneId }),
  };
}

// The plans page: creating and deleting whole plans. Not optimistic; the
// list is refetched after each.
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: async (plan) => {
      queryClient.setQueryData(planKey(plan.id), plan);
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlan,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: planKey(id) });
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    },
  });
}
