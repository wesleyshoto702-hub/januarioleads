import { useId } from "react";

/** Decorative light pulses follow fixed, page-specific lines, derived from the
 * user-supplied futuristic banner. All geometry stays inside its own header. */
export type BeamVariant =
  | "dashboard" | "leads" | "search" | "prospecting" | "opportunities"
  | "messages" | "finance" | "digital" | "proposals" | "campaigns"
  | "sequences" | "agenda" | "projects" | "settings";

export const BEAM_PATHS: Record<BeamVariant, readonly string[]> = {
  dashboard: [
    "M 380 190 Q 665 62 1030 -20",
    "M 520 206 C 660 95 850 24 1080 5",
    "M 635 -35 C 666 38 680 104 700 210",
  ],
  leads: [
    "M 440 180 C 640 100 810 150 1040 18",
    "M 545 203 C 775 105 852 90 1075 -20",
    "M 750 -30 L 930 198",
  ],
  search: [
    "M 455 160 Q 750 145 1035 -16",
    "M 520 -20 Q 835 85 1060 152",
    "M 760 -15 Q 715 90 770 204",
  ],
  prospecting: [
    "M 480 198 L 745 -30",
    "M 625 211 L 895 -35",
    "M 755 208 L 1030 -25",
  ],
  opportunities: [
    "M 500 185 Q 735 122 920 -28",
    "M 620 208 Q 795 58 1070 50",
    "M 785 -25 Q 865 82 1070 178",
  ],
  messages: [
    "M 460 66 C 600 10 810 10 1085 70",
    "M 465 117 C 685 65 820 92 1080 151",
    "M 590 205 C 780 100 900 125 1060 177",
  ],
  finance: [
    "M 505 205 L 625 155 L 730 166 L 865 42 L 1050 -30",
    "M 565 210 L 690 187 L 830 88 L 1015 0",
    "M 730 205 L 925 140 L 1080 70",
  ],
  digital: [
    "M 465 180 Q 650 -10 840 80 T 1065 70",
    "M 580 205 Q 810 5 1045 5",
    "M 690 -25 Q 740 100 990 195",
  ],
  proposals: [
    "M 480 185 L 720 40 L 1020 40",
    "M 600 208 L 810 95 L 1070 95",
    "M 785 -10 L 1025 185",
  ],
  campaigns: [
    "M 490 190 Q 685 135 785 25 T 1060 40",
    "M 565 205 Q 785 65 1050 -15",
    "M 775 -30 Q 845 70 1035 205",
  ],
  sequences: [
    "M 475 165 L 625 165 L 740 70 L 900 70 L 1050 -20",
    "M 555 205 L 680 205 L 815 115 L 1070 115",
    "M 695 -20 L 760 40 L 875 40",
  ],
  agenda: [
    "M 460 180 Q 650 65 815 155 T 1060 50",
    "M 575 200 Q 780 40 1080 -15",
    "M 780 -15 L 930 200",
  ],
  projects: [
    "M 485 180 L 660 180 L 810 35 L 1055 35",
    "M 575 205 L 730 120 L 875 120 L 1055 -10",
    "M 750 -25 L 920 205",
  ],
  settings: [
    "M 500 175 Q 790 -25 1030 15",
    "M 630 205 Q 775 90 1065 125",
  ],
};

export function HeaderLightTrails({ variant }: { variant: BeamVariant }) {
  const id = useId().replace(/:/g, "");
  const paths = BEAM_PATHS[variant];
  return (
    <div className={"jl-header-beams jl-header-beams--" + variant}
      aria-hidden="true" data-header-beam={variant}>
      <svg viewBox="0 0 1000 180" preserveAspectRatio="none"
        focusable="false" role="presentation">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="48%" stopColor="var(--primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {paths.map((d, index) => (
          <g key={d}>
            <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.1"
              strokeOpacity={index === 0 ? .25 : .18} vectorEffect="non-scaling-stroke" />
            <path className="jl-header-beam-pulse" d={d} pathLength={1000}
              fill="none" stroke={"url(#" + id + ")"}
              strokeWidth="2.1" vectorEffect="non-scaling-stroke"
              style={{ animationDelay: (index * -1.45) + "s",
                animationDuration: (4.2 + index * .9) + "s" }} />
          </g>
        ))}
      </svg>
    </div>
  );
}
