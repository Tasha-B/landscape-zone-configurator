
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import RecommendationCard from "./RecommendationCard";
import SpaceMapperPlan, { HINT_DELAY_MS, HINT_HOLD_S, HINT_TOTAL_S } from "./SpaceMapperPlan";
import { HINT_ZONE_ID } from "./PlanBackground";
import SpaceMapperPanel from "./SpaceMapperPanel";
import SpaceMapperSheet from "./SpaceMapperSheet";
import { useLanguage } from "../../lib/i18n/LanguageProvider";
import { useSelection } from "../../lib/selection/SelectionProvider";
import type { Zone } from "../../lib/plan/types";
import { demoPlan } from "../../../../backend/prisma/demo-plan-data";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import SectionNumber from "../SectionNumber/SectionNumber";
import Button from "../Button/Button";

// The static demo plan, read from the seed data until the plan comes from
// the API (phase 4, step 5)
const plan = demoPlan;

export default function SpaceMapper() {
  const { lang, t } = useLanguage();
  const { selectedZones: selectedIds, toggle: toggleZone, clear: clearSelection } = useSelection();
  const prefersReducedMotion = usePrefersReducedMotion();

  const selectedZones = selectedIds
    .map((id) => plan.zones.find((zone) => zone.id === id))
    .filter((zone): zone is Zone => Boolean(zone));

  // Reception's one-shot demo cycle. `hintActive` is render-read state; the
  // two refs are only ever touched from the viewport callback and its own
  // nested timeouts (never from a click handler reachable through the zone
  // `.map()` below), so React Compiler's "no ref access during render"
  // check stays satisfied. `hintFiredRef` guards the viewport trigger
  // itself (belt-and-suspenders alongside framer-motion's own
  // `viewport.once`); `hintSpentRef` is set the moment Reception is ever
  // really selected, so a still-pending delay/hide timeout can't resurrect
  // the hint afterwards (e.g. select-then-deselect within the 800ms delay).
  const [hintActive, setHintActive] = useState(false);
  const hintFiredRef = useRef(false);
  const hintSpentRef = useRef(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  // The desktop instance is display:none on mobile, so its viewport-triggered
  // hint above plays on an invisible element there — mobile users need their
  // own trigger point. Opening the sheet is that point: same one-shot
  // draw/hold/fade cycle and the same hintSpentRef (a real selection anywhere
  // cancels both triggers), just on its own fired-guard so it isn't silently
  // skipped because the desktop trigger already fired first off-screen.
  const [sheetHintActive, setSheetHintActive] = useState(false);
  const sheetHintFiredRef = useRef(false);

  useEffect(() => {
    if (selectedIds.includes(HINT_ZONE_ID)) {
      hintSpentRef.current = true;
    }
  }, [selectedIds]);

  function handleMapViewportEnter() {
    if (hintFiredRef.current) return;
    hintFiredRef.current = true;
    if (selectedIds.length > 0) return;
    setTimeout(() => {
      if (hintSpentRef.current) return;
      setHintActive(true);
      const activeMs = (prefersReducedMotion ? HINT_HOLD_S : HINT_TOTAL_S) * 1000;
      setTimeout(() => setHintActive(false), activeMs);
    }, HINT_DELAY_MS);
  }

  useEffect(() => {
    if (!sheetOpen || sheetHintFiredRef.current) return;
    sheetHintFiredRef.current = true;
    if (selectedIds.length > 0) return;
    const delayTimer = setTimeout(() => {
      if (hintSpentRef.current) return;
      setSheetHintActive(true);
      const activeMs = (prefersReducedMotion ? HINT_HOLD_S : HINT_TOTAL_S) * 1000;
      setTimeout(() => setSheetHintActive(false), activeMs);
    }, HINT_DELAY_MS);
    return () => clearTimeout(delayTimer);
  }, [sheetOpen, selectedIds, prefersReducedMotion]);

  return (
    <motion.section
      id="map"
      onViewportEnter={handleMapViewportEnter}
      viewport={{ once: true, amount: 0.4 }}
    >
      <SectionNumber number="01" />
      <h2 className="font-display text-section text-forest-dark">{t.map.title}</h2>
      <p className="mt-sm max-w-[36rem] font-body text-body text-ink/70">{t.map.intro}</p>

      {/* < 640px: collapsed preview card + "Explore the plan" pill (batch K,
          item 3, stages 2-3). Both the card and the pill open the bottom
          sheet; its content is still a placeholder until stage 4 wires the
          real interactive plan in. ≥640px keeps the exact markup/behavior
          this section always had. */}
      <div className="mt-lg sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t.map.exploreButton}
          className="mx-auto block w-full max-w-[240px] cursor-pointer"
        >
          <SpaceMapperPlan
            plan={plan}
            mode="preview"
            lang={lang}
            t={t}
            selectedIds={selectedIds}
            prefersReducedMotion={prefersReducedMotion}
          />
        </button>
        <Button type="button" variant="primary" className="mt-md w-full" onClick={() => setSheetOpen(true)}>
          {t.map.exploreButton}
        </Button>
        {selectedZones.length > 0 && (
          <div className="mt-md">
            <span className="inline-block rounded-full bg-forest-dark/10 px-3 py-1 font-body text-xs font-semibold text-forest-dark">
              {t.map.zonesSelectedPrefix}
              {selectedZones.length}
              {t.map.zonesSelectedSuffix}
            </span>
            <div className="mt-sm flex flex-col">
              {selectedZones.map((zone, index) => (
                <RecommendationCard
                  key={zone.id}
                  num={String(index + 1).padStart(2, "0")}
                  content={zone.content[lang]}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-lg hidden flex-col items-start gap-md sm:flex lg:flex-row">
        <div className="w-full lg:min-w-0 lg:flex-1">
          <SpaceMapperPlan
            plan={plan}
            mode="interactive"
            lang={lang}
            t={t}
            selectedIds={selectedIds}
            onToggleZone={toggleZone}
            hintActive={hintActive}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>

        <aside className="flex w-full flex-col lg:w-[300px] lg:flex-none">
          <SpaceMapperPanel t={t} lang={lang} selectedZones={selectedZones} onClear={clearSelection} />
        </aside>
      </div>

      <SpaceMapperSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        reducedMotion={prefersReducedMotion}
        t={t}
        plan={
          <SpaceMapperPlan
            plan={plan}
            mode="interactive"
            lang={lang}
            t={t}
            selectedIds={selectedIds}
            onToggleZone={toggleZone}
            hintActive={sheetHintActive}
            prefersReducedMotion={prefersReducedMotion}
            showPalette={false}
            padding="0"
            rotate={false}
          />
        }
      >
        <SpaceMapperPanel t={t} lang={lang} selectedZones={selectedZones} onClear={clearSelection} />
      </SpaceMapperSheet>
    </motion.section>
  );
}
