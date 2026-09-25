import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { MONO, SANS, type Theme } from "./theme";

export const FPS = 30;
/** Every scene fades out over the same beat. */
export const FADE = 15;
export const s = (seconds: number) => Math.round(seconds * FPS);

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
export const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1);

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over [start, start + len), ease-out. */
export const enter = (frame: number, start: number, len = 18) =>
  interpolate(frame, [start, start + len], [0, 1], { ...CLAMP, easing: EASE_OUT });

/** 0 → 1 over [start, start + len), ease-in-out (for morphs between two held states). */
export const morph = (frame: number, start: number, len: number) =>
  interpolate(frame, [start, start + len], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// --- the engine's maths (default desktop settings), used only to tick readouts between the
// held states; every held state is checked against `fluid explain`. ---
export const unitAt = (W: number, H: number) => Math.max(0.58, Math.min(W / 1440, H / 900));
export const damp = (u: number, d: number) => (u >= 1 ? u : 1 - d * (1 - u));
export const f4 = (n: number) => n.toFixed(4);
export const f1 = (n: number) => n.toFixed(1);

// --- theme context ---
const ThemeCtx = createContext<Theme | null>(null);
export const ThemeProvider = ThemeCtx.Provider;
export const useTheme = () => {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error("no theme");
  return t;
};

/** A scene: holds its children and fades the whole frame out over the last FADE frames. */
export const Scene: React.FC<{ dur: number; children: React.ReactNode; fade?: number }> = ({
  dur,
  children,
  fade = FADE,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [dur - 1 - fade, dur - 1], [1, 0], { ...CLAMP, easing: EASE_IN });
  return (
    <AbsoluteFill style={{ opacity, padding: "56px 72px", fontFamily: SANS }}>{children}</AbsoluteFill>
  );
};

/** An element that animates into its reserved layout slot at frame `at`. */
export const In: React.FC<{
  at: number;
  len?: number;
  dy?: number;
  dx?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, len = 18, dy = 14, dx = 0, style, children }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, len);
  return (
    <div style={{ opacity: p, translate: `${(1 - p) * dx}px ${(1 - p) * dy}px`, ...style }}>{children}</div>
  );
};

export const Headline: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 46 }) => {
  const t = useTheme();
  return (
    <div style={{ fontSize: size, fontWeight: 700, color: t.ink, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
      {children}
    </div>
  );
};

export const Sub: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 26 }) => {
  const t = useTheme();
  return <div style={{ fontSize: size, color: t.muted, lineHeight: 1.3, marginTop: 10 }}>{children}</div>;
};

export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 22, color, weight = 500, style }) => {
  const t = useTheme();
  return (
    <span style={{ fontFamily: MONO, fontSize: size, color: color ?? t.ink, fontWeight: weight, ...style }}>
      {children}
    </span>
  );
};

/** `--name  value` readout, value in accent. */
export const Readout: React.FC<{ name: string; value: string; size?: number; color?: string }> = ({
  name,
  value,
  size = 24,
  color,
}) => {
  const t = useTheme();
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
      <Mono size={size} color={t.muted}>
        {name}
      </Mono>
      <Mono size={size} color={color ?? t.accent} weight={700}>
        {value}
      </Mono>
    </div>
  );
};
