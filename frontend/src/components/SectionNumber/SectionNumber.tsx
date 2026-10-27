interface SectionNumberProps {
  number: string;
}

export default function SectionNumber({ number }: SectionNumberProps) {
  return (
    <div className="mb-2">
      <div className="inline-block rotate-[-2deg] font-marker text-[22px] text-gold-dark">{number}</div>
      <div className="mt-0.5 h-[5px] w-10 rotate-[-1.2deg] rounded bg-gold/45" />
    </div>
  );
}
