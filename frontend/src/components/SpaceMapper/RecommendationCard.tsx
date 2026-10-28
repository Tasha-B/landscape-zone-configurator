import type { ZoneContent } from "../../lib/plan/types";

interface RecommendationCardProps {
  num: string;
  content: ZoneContent;
}

export default function RecommendationCard({ num, content }: RecommendationCardProps) {
  return (
    <div className="border-b border-[#2A2620]/[0.18] py-sm">
      <div className="flex items-baseline gap-2.5">
        <span className="font-marker text-base text-[#2A2620]/50">{num}</span>
        <span className="font-display text-lg text-forest-dark">{content.name}</span>
      </div>
      <p className="mt-0.5 font-body text-xs italic text-ink/55">{content.tagline}</p>
      <p className="mt-1.5 font-body text-sm font-semibold text-gold-dark">{content.recommendation}</p>
      <p className="mt-1.5 font-body text-body text-ink/65">{content.rationale}</p>
    </div>
  );
}
