import React from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "./theme";
import { DesktopPage, PhonePage, BrowserWindow } from "./MiniPage";
import {
  FADE,
  Headline,
  In,
  Mono,
  Readout,
  Scene,
  Sub,
  damp,
  enter,
  f1,
  f4,
  lerp,
  morph,
  s,
  unitAt,
  useTheme,
} from "./lib";

// Every scene: animate IN → HOLD still (sized to its text) → fade OUT.
// dur = inEnd + hold + FADE. Numbers are `fluid explain` values (see STORYBOARD.md).
const dur = (inEnd: number, holdSeconds: number, fade = FADE) => inEnd + s(holdSeconds) + fade;

/* ─────────────────────────── 1 · the problem ─────────────────────────── */

export const PROBLEM = { inEnd: 76, hold: 3.6 };
export const PROBLEM_DUR = dur(PROBLEM.inEnd, PROBLEM.hold);

const Problem: React.FC = () => {
  const t = useTheme();
  const PW = 356;
  const panels = [
    { W: 1280, H: 800, verdict: "Cramped: runs off the side" },
    { W: 2560, H: 1440, verdict: "Floating: lost in margin" },
    { W: 1440, H: 700, verdict: "Cut off: 200px below the fold" },
  ];
  return (
    <Scene dur={PROBLEM_DUR}>
      <In at={0}>
        <Headline>Drawn at 1440×900. Built in fixed px.</Headline>
      </In>
      <In at={8}>
        <Sub>Exact on that one screen. Wrong on every other.</Sub>
      </In>
      <div style={{ display: "flex", gap: 34, flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 20 }}>
        {panels.map((p, i) => {
          const k = PW / p.W;
          const cut = i === 2;
          return (
            <div key={i} style={{ width: PW, display: "flex", flexDirection: "column", gap: 14 }}>
              <In at={24 + i * 12}>
                <div style={{ position: "relative" }}>
                  <BrowserWindow W={p.W} H={p.H} k={k}>
                    <DesktopPage W={p.W} H={p.H} k={k} u={1} fixed />
                    {p.W < 1440 ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: t.bad,
                        }}
                      />
                    ) : null}
                  </BrowserWindow>
                  {cut ? (
                    <div
                      style={{
                        marginTop: 4,
                        height: (900 - p.H) * k,
                        border: `2px dashed ${t.bad}`,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: t.bad,
                        fontFamily: MONO,
                        fontSize: 18,
                      }}
                    >
                      the rest of the hero
                    </div>
                  ) : null}
                </div>
              </In>
              <In at={34 + i * 12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Mono size={22} weight={700}>
                    {p.W} × {p.H}
                  </Mono>
                  <div style={{ fontSize: 22, color: t.bad, fontWeight: 600 }}>{p.verdict}</div>
                </div>
              </In>
            </div>
          );
        })}
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 2 · the unit ─────────────────────────── */

// states: 1440×900 → 1280×800 → 1920×1200
const U_IN = 46;
const U_A = U_IN + s(1.2); // start shrinking
const U_B = U_A + 30; // at 1280
const U_C = U_B + s(1.2); // start growing
const U_D = U_C + 40; // at 1920
export const UNIT = { inEnd: U_D, hold: 3.0 };
export const UNIT_DUR = dur(UNIT.inEnd, UNIT.hold);
export const UNIT_POSTER = U_D + s(1.5);

const UnitScene: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const a = morph(frame, U_A, U_B - U_A);
  const b = morph(frame, U_C, U_D - U_C);
  const W = b > 0 ? lerp(1280, 1920, b) : lerp(1440, 1280, a);
  const H = b > 0 ? lerp(800, 1200, b) : lerp(900, 800, a);
  const u = unitAt(W, H);
  const k = 0.3;
  const note = b > 0.5 ? "Bigger window, same proportions." : a > 0.5 ? "Smaller window, same proportions." : "At the artboard: pixel-exact.";
  return (
    <Scene dur={UNIT_DUR}>
      <In at={0}>
        <Headline>Every drawn number becomes n × unit.</Headline>
      </In>
      <In at={8}>
        <Sub>The unit is 1px at the 1440×900 artboard, and it follows the window.</Sub>
      </In>
      <div style={{ display: "flex", gap: 40, marginTop: 36, alignItems: "center", flex: 1 }}>
        <In at={20} style={{ width: 470, display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              background: t.codeBg,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Mono size={22} color={t.muted}>
              drawn: <span style={{ color: t.ink }}>padding 120</span>
            </Mono>
            <Mono size={22} color={t.muted}>
              css:&nbsp;&nbsp; <span style={{ color: t.ink }}>calc(120 * var(</span>
              <span style={{ color: t.accent, fontWeight: 700 }}>--fluid</span>
              <span style={{ color: t.ink }}>))</span>
            </Mono>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 4 }}>
            <Readout name="window " value={`${Math.round(W)} × ${Math.round(H)}`} color={t.ink} />
            <Readout name="--fluid" value={f4(u)} size={30} />
            <Readout name="120 → " value={`${f1(120 * u)} px`} color={t.ink} />
          </div>
          <div style={{ fontSize: 24, color: t.good, fontWeight: 600, paddingLeft: 4 }}>{note}</div>
        </In>
        <In at={28} style={{ flex: 1, height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BrowserWindow W={W} H={H} k={k}>
            <DesktopPage W={W} H={H} k={k} u={u} disp={damp(u, 0.62)} />
          </BrowserWindow>
        </In>
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 3 · your frame sets the base ─────────────────────────── */

// The design app's desktop frame → the three settings in :root. The frame resizes
// 1440×900 → 1680×1050 → 1920×1080 (the same design drawn on a bigger frame) and the settings
// follow. With the base set to the frame, a window that size renders at --fluid 1.0000
// (`fluid explain <W>x<H> --set --fluid-desktop-base-width=<W> --set --fluid-desktop-base-height=<H>`).
const FR_FLY = 58; // the frame's W × H lift off the label…
const FR_FLY_LEN = 24;
const FR_FLY_GAP = 5; // …900 follows 1440
const FR_TYPE = 90; // container-width types in, 3 frames a character
const FR_NOTE = 98;
const FR_READ = 106;
const FR_R1 = FR_READ + 18 + s(2.8); // → 1680×1050
const FR_R_LEN = 30;
const FR_R2 = FR_R1 + FR_R_LEN + s(1.3); // → 1920×1080
const FR_LAST = FR_R2 + FR_R_LEN + 4; // "whatever your designer draws on"
export const FRAME = { inEnd: FR_LAST + 18, hold: 2.8 };
export const FRAME_DUR = dur(FRAME.inEnd, FRAME.hold);

// scene-absolute layout (px on the 1280×720 stage), so the flying numbers land exactly
const FR_K = 0.29; // drawn px → diagram px inside the design app
const FR_X = 102; // frame's left edge
const FR_Y = 240; // frame's top edge
const FR_LABEL_Y = FR_Y - 32;
const CODE_X = 712; // code card
const CODE_Y = 240;
const CODE_W = 496;
const CODE_BAR = 36;
const CODE_PAD_X = 18;
const CODE_PAD_Y = 16;
const CODE_LINE = 28;
const CODE_BODY_X = CODE_X + CODE_PAD_X;
const CODE_BODY_Y = CODE_Y + CODE_BAR + CODE_PAD_Y;
const CODE_FONT = 18;
// monospace columns (1ch) where each value starts
const COL_LABEL_W = "Desktop · ".length;
const COL_LABEL_H = "Desktop · 1440 × ".length;
const COL_W = "  --fluid-desktop-base-width: ".length;
const COL_H = "  --fluid-desktop-base-height: ".length;

const FrameScene: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const a = morph(frame, FR_R1, FR_R_LEN);
  const b = morph(frame, FR_R2, FR_R_LEN);
  const W = b > 0 ? lerp(1680, 1920, b) : lerp(1440, 1680, a);
  const H = b > 0 ? lerp(1050, 1080, b) : lerp(900, 1050, a);
  const CW = lerp(1680, 1920, b);
  const w = Math.round(W);
  const h = Math.round(H);
  const cw = Math.round(CW);
  const resizing = (a > 0 && a < 1) || (b > 0 && b < 1);
  const cursor = Math.max(
    enter(frame, FR_R1 - 10, 10) * (1 - enter(frame, FR_R1 + FR_R_LEN + 4, 10)),
    enter(frame, FR_R2 - 10, 10) * (1 - enter(frame, FR_R2 + FR_R_LEN + 4, 10)),
  );
  const pick = enter(frame, FR_FLY - 8, 8);
  const flyW = morph(frame, FR_FLY, FR_FLY_LEN);
  const flyH = morph(frame, FR_FLY + FR_FLY_GAP, FR_FLY_LEN);
  const typed = Math.max(0, Math.min(4, Math.floor((frame - FR_TYPE) / 3) + 1));
  const fw = W * FR_K;
  const fh = H * FR_K;

  const mono: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: CODE_FONT,
    lineHeight: `${CODE_LINE}px`,
    whiteSpace: "pre",
  };
  const value = (v: number, shown: boolean, extra?: React.CSSProperties) => (
    <span
      style={{
        color: t.dim,
        fontWeight: 700,
        opacity: shown ? 1 : 0,
        background: resizing ? t.amberBg : "transparent",
        borderRadius: 4,
        ...extra,
      }}
    >
      {v}
    </span>
  );
  // a number lifting off the frame label and landing in its :root slot (px + ch, so it is exact)
  const Fly: React.FC<{ p: number; text: string; fromCol: number; toCol: number; toLine: number }> = ({
    p,
    text,
    fromCol,
    toCol,
    toLine,
  }) =>
    p > 0 && p < 1 ? (
      <div
        style={{
          ...mono,
          position: "absolute",
          left: `calc(${lerp(FR_X, CODE_BODY_X, p)}px + ${lerp(fromCol, toCol, p)}ch)`,
          top: lerp(FR_LABEL_Y, CODE_BODY_Y + toLine * CODE_LINE, p) - 46 * Math.sin(Math.PI * p),
          color: t.dim,
          fontWeight: 700,
          background: t.amberBg,
          borderRadius: 4,
        }}
      >
        {text}
      </div>
    ) : null;

  return (
    <Scene dur={FRAME_DUR}>
      <In at={0}>
        <Headline>The artboard is your design frame.</Headline>
      </In>
      <In at={8}>
        <Sub>Copy its size into :root. 1440×900 is only the default.</Sub>
      </In>
      <div style={{ position: "absolute", inset: 0 }}>
        {/* the design app: a dotted canvas with one desktop frame on it */}
        <In
          at={18}
          style={{
            position: "absolute",
            left: 72,
            top: 186,
            width: 604,
            height: 440,
            borderRadius: 14,
            border: `1px solid ${t.line}`,
            background: t.codeBg,
            backgroundImage: `radial-gradient(${t.line} 1.2px, transparent 1.6px)`,
            backgroundSize: "16px 16px",
          }}
        >
          {null}
        </In>
        <In at={24} style={{ position: "absolute", left: FR_X, top: FR_Y }}>
          <div style={{ position: "relative", width: fw, height: fh }}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
              <DesktopPage W={W} H={H} k={FR_K} u={unitAt(W, H)} />
            </div>
            <div style={{ position: "absolute", inset: -1, border: `2px solid ${t.dim}` }} />
            {[
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
            ].map(([x, y]) => (
              <div
                key={`${x}${y}`}
                style={{
                  position: "absolute",
                  left: x * fw - 5,
                  top: y * fh - 5,
                  width: 10,
                  height: 10,
                  background: t.panel,
                  border: `2px solid ${t.dim}`,
                  boxSizing: "border-box",
                }}
              />
            ))}
            {/* the designer's pointer on the corner handle while the frame resizes */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              style={{ position: "absolute", left: fw + 2, top: fh + 2, opacity: cursor }}
            >
              <path d="M2 2 L2 18 L7 13.5 L10.5 20.5 L13.5 19 L10 12 L17 12 Z" fill={t.ink} stroke={t.panel} strokeWidth="1.5" />
            </svg>
          </div>
        </In>
        <In at={30} style={{ ...mono, position: "absolute", left: FR_X, top: FR_LABEL_Y, color: t.muted }}>
          Desktop ·{" "}
          <span style={{ color: t.dim, fontWeight: 700, background: pick > 0 && flyH < 1 ? t.amberBg : "transparent", borderRadius: 4 }}>
            {w}
          </span>{" "}
          ×{" "}
          <span style={{ color: t.dim, fontWeight: 700, background: pick > 0 && flyH < 1 ? t.amberBg : "transparent", borderRadius: 4 }}>
            {h}
          </span>
        </In>

        {/* the settings */}
        <In
          at={40}
          style={{
            position: "absolute",
            left: CODE_X,
            top: CODE_Y,
            width: CODE_W,
            background: t.codeBg,
            border: `1px solid ${t.line}`,
            borderRadius: 14,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              height: CODE_BAR,
              boxSizing: "border-box",
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              borderBottom: `1px solid ${t.line}`,
              fontFamily: MONO,
              fontSize: 17,
              color: t.muted,
              background: t.panel,
            }}
          >
            src/app/globals.css
          </div>
          <div style={{ ...mono, padding: `${CODE_PAD_Y - 1}px ${CODE_PAD_X - 1}px`, color: t.ink }}>
            <span style={{ color: t.accent, fontWeight: 700 }}>:root</span> {"{"}
            {"\n"}
            {"  "}--fluid-desktop-base-width: {value(w, flyW >= 1)};{"\n"}
            {"  "}--fluid-desktop-base-height: {value(h, flyH >= 1)};{"\n"}
            {"  "}--fluid-desktop-container-width:{" "}
            <span style={{ color: t.dim, fontWeight: 700, background: b > 0 && b < 1 ? t.amberBg : "transparent", borderRadius: 4 }}>
              {String(cw).slice(0, typed)}
              <span style={{ opacity: 0 }}>{String(cw).slice(typed)}</span>
            </span>
            ;{"\n"}
            {"}"}
          </div>
        </In>
        <Fly p={flyW} text="1440" fromCol={COL_LABEL_W} toCol={COL_W} toLine={1} />
        <Fly p={flyH} text="900" fromCol={COL_LABEL_H} toCol={COL_H} toLine={2} />

        <div style={{ position: "absolute", left: CODE_X + 4, top: CODE_Y + 226, width: CODE_W, display: "flex", flexDirection: "column", gap: 12 }}>
          <In at={FR_NOTE}>
            <div style={{ fontSize: 20, color: t.muted }}>
              <Mono size={19} color={t.muted}>
                container-width
              </Mono>
              : how wide the content box may get
            </div>
          </In>
          <In at={FR_READ}>
            <Readout name={`--fluid at a ${w} × ${h} window`} value="1.0000" size={21} />
          </In>
          <In at={FR_LAST} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: t.good, lineHeight: 1.3 }}>
              1440, 1680, 1920… whatever your designer draws on.
            </div>
          </In>
        </div>
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 4 · tighter axis ─────────────────────────── */

const X_IN = 46;
const X_A = X_IN + 20;
const X_B = X_A + 42;
export const AXIS = { inEnd: X_B + 18, hold: 3.6 };
export const AXIS_DUR = dur(AXIS.inEnd, AXIS.hold);

const Bar: React.FC<{ label: string; value: number; win: boolean; show: number }> = ({ label, value, win, show }) => {
  const t = useTheme();
  const color = win ? t.accent : t.glyph;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Mono size={22} color={t.muted} style={{ width: 120 }}>
        {label}
      </Mono>
      <div style={{ width: value * 230, height: 26, borderRadius: 6, background: color }} />
      <Mono size={22} weight={700} color={win ? t.accent : t.ink}>
        {value.toFixed(3)}
      </Mono>
      <span
        style={{
          opacity: show,
          fontSize: 20,
          fontWeight: 700,
          color: t.accentInk,
          background: t.accent,
          borderRadius: 99,
          padding: "2px 12px",
        }}
      >
        wins
      </span>
    </div>
  );
};

const Axis: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const m = morph(frame, X_A, X_B - X_A);
  const W = 1440;
  const H = lerp(900, 700, m);
  const u = unitAt(W, H);
  const k = 0.36;
  const done = enter(frame, X_B, 18);
  return (
    <Scene dur={AXIS_DUR}>
      <In at={0}>
        <Headline>The tighter axis wins.</Headline>
      </In>
      <In at={8}>
        <Sub>A section drawn 900 tall always fits the window.</Sub>
      </In>
      <div style={{ display: "flex", gap: 48, marginTop: 40, alignItems: "center", flex: 1 }}>
        <div style={{ width: 520, display: "flex", flexDirection: "column", gap: 22 }}>
          <In at={18}>
            <Mono size={26} weight={700}>
              <span style={{ color: t.accent }}>--fluid</span> = min(W / 1440, H / 900)
            </Mono>
          </In>
          <In at={28} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Bar label="W / 1440" value={W / 1440} win={false} show={0} />
            <Bar label="H / 900" value={H / 900} win={m > 0.02} show={done} />
          </In>
          <div style={{ opacity: done, display: "flex", flexDirection: "column", gap: 8 }}>
            <Readout name="--fluid" value={f4(u)} size={30} />
            <div style={{ fontSize: 26, fontWeight: 700, color: t.good }}>
              <Mono size={26} color={t.good} weight={700}>
                900 × {f4(u)} = {Math.round(900 * u)}
              </Mono>{" "}
              ✓ fits
            </div>
          </div>
        </div>
        <In at={24} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <BrowserWindow W={W} H={H} k={k}>
            <DesktopPage W={W} H={H} k={k} u={u} disp={damp(u, 0.62)} />
          </BrowserWindow>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 18 }}>
            <div
              style={{
                height: 900 * u * k,
                width: 12,
                borderTop: `3px solid ${t.accent}`,
                borderBottom: `3px solid ${t.accent}`,
                borderRight: `3px solid ${t.accent}`,
              }}
            />
          </div>
          <Mono size={20} color={t.accent} weight={700} style={{ width: 90, marginTop: 18 }}>
            {Math.round(H)}px
          </Mono>
        </In>
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 5 · bands ─────────────────────────── */

export const BANDS = { inEnd: 92, hold: 3.6 };
export const BANDS_DUR = dur(BANDS.inEnd, BANDS.hold);

const Bands: React.FC = () => {
  const t = useTheme();
  const k = 0.26;
  const devices = [
    { band: "phone", W: 390, H: 844, u: 1.0, desc: "the 390 artboard", phone: true },
    { band: "tablet", W: 820, H: 1180, u: 1.1714, desc: "phone design, scaled up", phone: true },
    { band: "landscape", W: 844, H: 390, u: 1.0821, desc: "a phone on its side", phone: true },
    { band: "desktop", W: 1440, H: 900, u: 1.0, desc: "the 1440×900 artboard", phone: false },
  ];
  return (
    <Scene dur={BANDS_DUR}>
      <In at={0}>
        <Headline>Bands: each one scales its own artboard.</Headline>
      </In>
      <In at={8}>
        <Sub>The phone design is drawn once. No redraw per breakpoint.</Sub>
      </In>
      <div style={{ display: "flex", gap: 36, flex: 1, alignItems: "center", justifyContent: "center" }}>
        {devices.map((d, i) => (
          <div key={d.band} style={{ display: "flex", flexDirection: "column", gap: 12, width: Math.max(d.W * k, 220) }}>
            <In at={22 + i * 14} style={{ height: 1180 * k, display: "flex", alignItems: "flex-end" }}>
              <BrowserWindow W={d.W} H={d.H} k={k} chrome={false} radius={d.phone && d.band !== "tablet" ? 14 : 10}>
                {d.phone ? (
                  <PhonePage W={d.W} H={d.H} k={k} u={d.u} />
                ) : (
                  <DesktopPage W={d.W} H={d.H} k={k} u={d.u} />
                )}
              </BrowserWindow>
            </In>
            <In at={30 + i * 14} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.accent }}>{d.band}</div>
              <Mono size={19} color={t.muted}>
                {d.W} × {d.H}
              </Mono>
              <div style={{ fontSize: 19, color: t.ink }}>{d.desc}</div>
              <Mono size={19} color={t.ink} weight={700}>
                --fluid {f4(d.u)}
              </Mono>
            </In>
          </div>
        ))}
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 6 · type roles ─────────────────────────── */

export const TYPE = { inEnd: 76, hold: 3.6 };
export const TYPE_DUR = dur(TYPE.inEnd, TYPE.hold);

const TypeRoles: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const rows = [
    { name: "--fluid", role: "layout", v: 0.7111, c: t.glyph },
    { name: "--fluid-display", role: "headings", v: 0.8209, c: t.accent },
    { name: "--fluid-copy", role: "body text", v: 0.9047, c: t.good },
  ];
  const BW = 330;
  const samples = [
    { size: 64, label: "drawn", sub: "64px", c: t.glyph, ghost: true },
    { size: 45.5, label: "layout alone", sub: "45.5px", c: t.glyph, ghost: false },
    { size: 52.5, label: "display role", sub: "52.5px", c: t.accent, ghost: false },
  ];
  return (
    <Scene dur={TYPE_DUR}>
      <In at={0}>
        <Headline>Headings shrink more gently than the layout.</Headline>
      </In>
      <In at={8}>
        <Sub>At 1024×768, each type role reads the unit through its own damping.</Sub>
      </In>
      <div style={{ display: "flex", gap: 64, flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 20 }}>
        <div style={{ display: "flex", gap: 30, alignItems: "flex-end" }}>
          {samples.map((x, i) => (
            <In key={i} at={20 + i * 10} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  height: 80,
                  display: "flex",
                  alignItems: "flex-end",
                  fontSize: x.size,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: x.ghost ? "transparent" : x.c,
                  WebkitTextStroke: x.ghost ? `1.5px ${t.glyph}` : undefined,
                }}
              >
                Ag
              </div>
              <div style={{ fontSize: 19, color: t.muted }}>{x.label}</div>
              <Mono size={20} weight={700} color={x.ghost ? t.muted : x.c}>
                {x.sub}
              </Mono>
            </In>
          ))}
        </div>
        <div style={{ width: 470, display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
          {rows.map((r, i) => {
            const p = enter(frame, 30 + i * 10, 26);
            return (
              <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: Math.min(1, p * 2) }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 21, color: t.ink, fontWeight: 600, width: 110 }}>{r.role}</span>
                  <Mono size={20} color={t.muted}>
                    {r.name}
                  </Mono>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: BW, height: 24 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: BW * r.v * p,
                        background: r.c,
                        borderRadius: 5,
                      }}
                    />
                    <div
                      style={{ position: "absolute", left: BW - 1, top: -8, bottom: -8, borderLeft: `2px dashed ${t.muted}` }}
                    />
                  </div>
                  <Mono size={24} weight={700} color={r.c === t.glyph ? t.ink : r.c}>
                    {f4(r.v)}
                  </Mono>
                </div>
              </div>
            );
          })}
          <In at={60}>
            <Mono size={18} color={t.muted}>
              dashed line: 1.0000 at the artboard
            </Mono>
          </In>
        </div>
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 7 · the ui unit + limits ─────────────────────────── */

export const UI = { inEnd: 80, hold: 3.8 };
export const UI_DUR = dur(UI.inEnd, UI.hold);

const UiScene: React.FC = () => {
  const t = useTheme();
  const cols = [
    {
      W: 1440,
      H: 700,
      k: 0.33,
      u: 0.7778,
      ui: 1.0,
      code: null as string | null,
      caption: "Short window: the page fits, the nav keeps its size.",
    },
    {
      W: 2560,
      H: 1440,
      k: 0.186,
      u: 1.6,
      ui: 1.1667,
      code: ":root { --fluid-ui-grow-until: 1680; }",
      caption: "Past 1680 the header holds; the page keeps growing.",
    },
  ];
  return (
    <Scene dur={UI_DUR}>
      <In at={0}>
        <Headline>The header has its own unit: --fluid-ui.</Headline>
      </In>
      <In at={8}>
        <Sub>It follows the window's width, never its height, and can stop growing.</Sub>
      </In>
      <div style={{ display: "flex", gap: 44, flex: 1, alignItems: "center", justifyContent: "center" }}>
        {cols.map((c, i) => (
          <div key={i} style={{ width: 500, display: "flex", flexDirection: "column", gap: 12 }}>
            <In at={22 + i * 24} style={{ height: 300, display: "flex", alignItems: "flex-end" }}>
              <BrowserWindow W={c.W} H={c.H} k={c.k}>
                <DesktopPage W={c.W} H={c.H} k={c.k} u={c.u} ui={c.ui} disp={damp(c.u, 0.62)} markHeader />
              </BrowserWindow>
            </In>
            <In at={32 + i * 24} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Mono size={21} weight={700}>
                {c.W} × {c.H}
              </Mono>
              <div style={{ display: "flex", gap: 22 }}>
                <Readout name="--fluid" value={f4(c.u)} size={21} color={t.ink} />
                <Readout name="--fluid-ui" value={f4(c.ui)} size={21} />
              </div>
              <div style={{ fontSize: 21, color: t.ink }}>{c.caption}</div>
              {c.code ? (
                <Mono size={19} color={t.accent} weight={700}>
                  {c.code}
                </Mono>
              ) : null}
            </In>
          </div>
        ))}
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 8 · fluid init ─────────────────────────── */

const INIT_LINES: { kind: "cmd" | "q" | "ok" | "gap"; text: string; def?: string }[] = [
  { kind: "cmd", text: "fluid init" },
  { kind: "q", text: "Styling: tailwind-v4, css, scss or stylex?", def: "tailwind-v4" },
  { kind: "q", text: "Framework, for the browser-zoom head script: next, vite or none?", def: "next" },
  { kind: "q", text: "Desktop design frame, width x height", def: "1440x900" },
  { kind: "q", text: "The desktop layout starts at this window width (px)", def: "1024" },
  { kind: "q", text: "Phone design frame width", def: "390" },
  { kind: "q", text: "The page stops widening at (drawn px)", def: "1680" },
  { kind: "gap", text: "" },
  { kind: "ok", text: "fluid.config.json (tailwind-v4, next)" },
  { kind: "ok", text: "src/styles/fluid: 13 files" },
  { kind: "ok", text: "src/app/globals.css: added @import '../styles/fluid/fluid.css';" },
];
const INIT_STEP = 6;
export const INIT = { inEnd: 24 + INIT_LINES.length * INIT_STEP + 12, hold: 3.3 };
export const INIT_DUR = dur(INIT.inEnd, INIT.hold);

const Init: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  return (
    <Scene dur={INIT_DUR}>
      <In at={0}>
        <Headline>Set up once: fluid init.</Headline>
      </In>
      <In at={8}>
        <Sub>It asks the design questions. Every answer is also a flag.</Sub>
      </In>
      <In at={16} style={{ marginTop: 40 }}>
        <div
          style={{
            background: t.codeBg,
            border: `1px solid ${t.line}`,
            borderRadius: 14,
            padding: "22px 28px",
            fontFamily: MONO,
            fontSize: 21,
            lineHeight: 1.5,
            color: t.ink,
          }}
        >
          {INIT_LINES.map((l, i) => {
            const o = enter(frame, 24 + i * INIT_STEP, 10);
            if (l.kind === "gap") return <div key={i} style={{ height: 10 }} />;
            return (
              <div key={i} style={{ opacity: o, whiteSpace: "nowrap" }}>
                {l.kind === "cmd" ? (
                  <>
                    <span style={{ color: t.muted }}>$ </span>
                    <span style={{ fontWeight: 700 }}>{l.text}</span>
                  </>
                ) : l.kind === "q" ? (
                  <>
                    <span style={{ fontWeight: 700 }}>? </span>
                    {l.text} <span style={{ color: t.accent, fontWeight: 700 }}>({l.def})</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: t.good, fontWeight: 700 }}>✓ </span>
                    {l.text}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </In>
    </Scene>
  );
};

/* ─────────────────────────── 9 · use it ─────────────────────────── */

export const USE = { inEnd: 68, hold: 3.6 };
export const USE_DUR = dur(USE.inEnd, USE.hold);

const Card: React.FC<{ title: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  title,
  children,
  style,
}) => {
  const t = useTheme();
  return (
    <div
      style={{
        background: t.codeBg,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          padding: "8px 18px",
          borderBottom: `1px solid ${t.line}`,
          fontFamily: MONO,
          fontSize: 17,
          color: t.muted,
          background: t.panel,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: 21, lineHeight: 1.55, color: t.ink, whiteSpace: "pre" }}>
        {children}
      </div>
    </div>
  );
};

const Use: React.FC = () => {
  const t = useTheme();
  const A = ({ children }: { children: React.ReactNode }) => <span style={{ color: t.accent, fontWeight: 700 }}>{children}</span>;
  const V = ({ children }: { children: React.ReactNode }) => <span style={{ color: t.good }}>{children}</span>;
  const S = ({ children }: { children: React.ReactNode }) => <span style={{ color: t.amber }}>{children}</span>;
  const C = ({ children }: { children: React.ReactNode }) => <span style={{ color: t.muted }}>{children}</span>;
  return (
    <Scene dur={USE_DUR}>
      <In at={0}>
        <Headline>Write the drawn number.</Headline>
      </In>
      <In at={8}>
        <Sub>One import. Settings are CSS variables: live, no rebuild.</Sub>
      </In>
      <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
        <In at={22} style={{ width: 520 }}>
          <Card title="src/app/globals.css">
            <A>@import</A> <S>'tailwindcss'</S>;{"\n"}
            <A>@import</A> <S>'../styles/fluid/fluid.css'</S>;{"\n\n"}
            <A>:root</A> {"{"}
            {"\n"}
            {"  "}
            <C>{"/* a setting, not code */"}</C>
            {"\n"}
            {"  "}--fluid-desktop-scale-max: <V>1.4</V>;{"\n"}
            {"}"}
          </Card>
        </In>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <In at={36}>
            <Card title="Tailwind v4 · phone 48, desktop 120">
              {"<section "}
              <V>class</V>={"\""}
              <A>fluid-py-48 lg:fluid-py-120</A>
              {"\">"}
            </Card>
          </In>
          <In at={50}>
            <Card title="CSS · any stack">
              <A>.hero</A> {"{"}
              {"\n"}
              {"  "}padding-block: <V>calc(120 * var(--fluid))</V>;{"\n"}
              {"}"}
            </Card>
          </In>
        </div>
      </div>
    </Scene>
  );
};

/* ─────────────────────────── 10 · why it holds ─────────────────────────── */

export const PROOF = { inEnd: 90, hold: 3.5, fade: 21 };
export const PROOF_DUR = dur(PROOF.inEnd, PROOF.hold, PROOF.fade);

const Proof: React.FC = () => {
  const t = useTheme();
  const rows = [
    { head: "Pixel-exact at the artboard", detail: "1440×900 → --fluid 1.0000: 120 drawn px = 120 px" },
    { head: "Proportional everywhere else", detail: "one unit for the whole page, the tighter axis wins" },
    { head: "Browser zoom still works", detail: "text zooms 1:1 with Cmd/Ctrl + (WCAG 1.4.4)" },
  ];
  return (
    <Scene dur={PROOF_DUR} fade={PROOF.fade}>
      <In at={0}>
        <Headline>Exact where it was drawn. Proportional everywhere else.</Headline>
      </In>
      <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 44 }}>
        {rows.map((r, i) => (
          <In key={i} at={16 + i * 12} dx={-14} dy={0} style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                background: t.good,
                color: t.panel,
                fontSize: 26,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: t.ink }}>{r.head}</div>
              <Mono size={21} color={t.muted}>
                {r.detail}
              </Mono>
            </div>
          </In>
        ))}
      </div>
      <In at={58} style={{ marginTop: 44 }}>
        <div
          style={{
            display: "inline-flex",
            gap: 14,
            alignItems: "center",
            padding: "12px 20px",
            border: `1px solid ${t.line}`,
            borderRadius: 12,
            background: t.panel,
          }}
        >
          <Mono size={21} weight={700}>
            18,840 engine checks
          </Mono>
          <Mono size={21} color={t.muted}>
            · Chromium · WebKit · Firefox ·
          </Mono>
          <Mono size={21} weight={700} color={t.good}>
            0 failures
          </Mono>
        </div>
      </In>
      <In at={72} style={{ position: "absolute", right: 72, bottom: 56 }}>
        <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: t.ink, letterSpacing: "-0.02em" }}>
          <span style={{ color: t.accent }}>/</span>fluid-design
        </div>
      </In>
    </Scene>
  );
};

export const SCENES: { name: string; dur: number; C: React.FC; holdMid: number }[] = [
  { name: "problem", dur: PROBLEM_DUR, C: Problem, holdMid: PROBLEM.inEnd + s(PROBLEM.hold) / 2 },
  { name: "unit", dur: UNIT_DUR, C: UnitScene, holdMid: UNIT.inEnd + s(UNIT.hold) / 2 },
  { name: "frame", dur: FRAME_DUR, C: FrameScene, holdMid: FRAME.inEnd + s(FRAME.hold) / 2 },
  { name: "axis", dur: AXIS_DUR, C: Axis, holdMid: AXIS.inEnd + s(AXIS.hold) / 2 },
  { name: "bands", dur: BANDS_DUR, C: Bands, holdMid: BANDS.inEnd + s(BANDS.hold) / 2 },
  { name: "type", dur: TYPE_DUR, C: TypeRoles, holdMid: TYPE.inEnd + s(TYPE.hold) / 2 },
  { name: "ui", dur: UI_DUR, C: UiScene, holdMid: UI.inEnd + s(UI.hold) / 2 },
  { name: "init", dur: INIT_DUR, C: Init, holdMid: INIT.inEnd + s(INIT.hold) / 2 },
  { name: "use", dur: USE_DUR, C: Use, holdMid: USE.inEnd + s(USE.hold) / 2 },
  { name: "proof", dur: PROOF_DUR, C: Proof, holdMid: PROOF.inEnd + s(PROOF.hold) / 2 },
];

export const TOTAL = SCENES.reduce((a, x) => a + x.dur, 0);
