import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreatePlan } from "../../lib/api/mutations";
import { useLanguage } from "../../lib/i18n/LanguageProvider";
import { NEW_PLAN } from "../../lib/plan/defaults";
import Button from "../Button/Button";

// The API's limit (CreatePlanDto)
const MAX_NAME = 200;

// Only a name: the sheet size, scale and background are the defaults, and
// the editor changes them. A created plan opens in the editor.
export default function NewPlanForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const create = useCreatePlan();
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, ...NEW_PLAN }, { onSuccess: (plan) => navigate(`/plans/${plan.id}/edit`) });
  }

  return (
    <form onSubmit={submit} className="mt-md flex flex-col gap-xs sm:flex-row sm:items-end sm:gap-sm">
      <label className="flex flex-col gap-1 font-body text-sm font-semibold text-forest-dark sm:w-[24rem]">
        {t.plans.newPlanLabel}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={MAX_NAME}
          className="rounded border border-forest-dark/30 bg-paper px-3 py-2.5 font-body text-body font-normal text-ink outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/40"
        />
      </label>
      <Button type="submit" variant="primary" disabled={create.isPending}>
        {create.isPending ? t.plans.creating : t.plans.create}
      </Button>
      {create.isError && (
        <p role="alert" className="font-body text-sm text-error sm:self-center">
          {t.plans.createError}
        </p>
      )}
    </form>
  );
}
