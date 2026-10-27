import { AnimatePresence, motion } from "framer-motion";
import RecommendationCard from "./RecommendationCard";
import { zoneContent, type SpaceZone } from "./zoneData";
import type { Lang, Translations } from "../../lib/i18n/translations";

interface SpaceMapperPanelProps {
  t: Translations;
  lang: Lang;
  selectedZones: SpaceZone[];
  onClear: () => void;
}

// "Your plan" results panel — the empty-state note or the running list of
// selected zones plus "start over". Shared by the desktop aside and the
// mobile bottom sheet (batch K, item 3, stage 4) so the two don't drift.
export default function SpaceMapperPanel({ t, lang, selectedZones, onClear }: SpaceMapperPanelProps) {
  return (
    <div className="flex w-full flex-col">
      <div className="font-marker text-2xl text-forest-dark">{t.map.panelTitle}</div>
      <div className="mt-0.5 h-[7px] w-24 rotate-[-1.2deg] rounded bg-gold/45" />

      {selectedZones.length === 0 ? (
        <div className="mt-md flex flex-col gap-3.5">
          <div className="font-marker text-xl text-[#2A2620]">{t.map.panelEmpty1}</div>
          <p className="font-body text-[13px] leading-normal text-ink/50">{t.map.panelEmpty2}</p>
        </div>
      ) : (
        <div className="mt-sm flex flex-col">
          <AnimatePresence initial={false}>
            {selectedZones.map((zone, index) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <RecommendationCard
                  num={String(index + 1).padStart(2, "0")}
                  content={zoneContent(zone, lang)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={onClear}
            className="mt-sm self-start font-marker text-lg text-gold-dark underline decoration-transparent underline-offset-4 transition-colors hover:decoration-gold-dark"
          >
            {t.map.startOver}
          </button>
        </div>
      )}
    </div>
  );
}
