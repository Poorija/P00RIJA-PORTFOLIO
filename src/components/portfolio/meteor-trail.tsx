"use client";

export type MeteorVisualStyle = "realistic" | "aurora" | "minimal";
export type MeteorHeadStyle = "comet" | "star" | "diamond" | "none" | "emoji";

export function MeteorTrail({
  color,
  length,
  thickness,
  glow,
  headSize,
  style = "realistic",
  headStyle = "comet",
  emoji = "",
}: {
  color: string;
  length: number;
  thickness: number;
  glow: number;
  headSize: number;
  style?: MeteorVisualStyle;
  headStyle?: MeteorHeadStyle;
  emoji?: string;
}) {
  const h = Math.max(18, headSize * 5, thickness * 12);
  const softGlow = Math.max(0, Math.min(1, glow));
  const tailColor = style === "aurora" ? "var(--ai-2)" : color;
  const minimal = style === "minimal";

  return (
    <div className="relative" style={{ width: length, height: h }}>
      {!minimal && (
        <span
          className="absolute end-0 top-1/2 block -translate-y-1/2 rounded-full"
          style={{
            width: "92%",
            height: Math.max(4, thickness * 5),
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${tailColor} ${34 * softGlow}%, transparent) 72%, color-mix(in srgb, ${color} ${78 * softGlow}%, transparent))`,
            filter: `blur(${2.5 + softGlow * 3}px)`,
            opacity: 0.65,
          }}
        />
      )}

      <span
        className="absolute end-0 top-1/2 block -translate-y-1/2"
        style={{
          width: "100%",
          height: Math.max(1, thickness * 2.6),
          clipPath: "polygon(0 48%, 100% 0, 100% 100%, 0 52%)",
          background: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${tailColor} 18%, transparent) 42%, color-mix(in srgb, ${color} 74%, transparent) 86%, #fff 100%)`,
          opacity: minimal ? 0.72 : 0.92,
        }}
      />

      <span
        className="absolute end-0 top-1/2 block -translate-y-1/2 rounded-full"
        style={{
          width: "68%",
          height: Math.max(0.65, thickness * 0.65),
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.96))",
        }}
      />

      {headStyle !== "none" && headStyle !== "emoji" && (
        <span
          className="absolute end-0 top-1/2 block -translate-y-1/2"
          style={{
            width: headSize,
            height: headSize,
            borderRadius: headStyle === "comet" ? "999px" : headStyle === "diamond" ? "2px" : 0,
            clipPath: headStyle === "star" ? "polygon(50% 0,59% 40%,100% 50%,59% 60%,50% 100%,41% 60%,0 50%,41% 40%)" : undefined,
            transform: `translate(45%, -50%) ${headStyle === "diamond" ? "rotate(45deg)" : ""}`,
            background: headStyle === "comet" ? `radial-gradient(circle at 35% 35%, #fff 0 22%, ${color} 55%, transparent 76%)` : "#fff",
            boxShadow: minimal ? "none" : `0 0 ${4 + softGlow * 7}px ${color}, 0 0 ${10 + softGlow * 13}px color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        />
      )}

      {headStyle === "emoji" && emoji && (
        <span
          className="absolute end-0 top-1/2 select-none leading-none"
          style={{ fontSize: Math.max(10, headSize * 3), transform: "translate(40%, -50%)", filter: minimal ? "none" : `drop-shadow(0 0 5px ${color})` }}
        >
          {emoji.slice(0, 4)}
        </span>
      )}
    </div>
  );
}
