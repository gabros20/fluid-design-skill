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

/* ─────────────────────────── 3 · tighter axis ─────────────────────────── */

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

/* ─────────────────────────── 4 · bands ─────────────────────────── */

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

/* ─────────────────────────── 5 · type roles ─────────────────────────── */

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

/* ─────────────────────────── 6 · the ui unit + limits ─────────────────────────── */

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

/* ─────────────────────────── 7 · fluid init ─────────────────────────── */

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

/* ─────────────────────────── 8 · use it ─────────────────────────── */

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
            <C>/* a setting, not code */</C>
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

/* ─────────────────────────── 9 · why it holds ─────────────────────────── */

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
  { name: "axis", dur: AXIS_DUR, C: Axis, holdMid: AXIS.inEnd + s(AXIS.hold) / 2 },
  { name: "bands", dur: BANDS_DUR, C: Bands, holdMid: BANDS.inEnd + s(BANDS.hold) / 2 },
  { name: "type", dur: TYPE_DUR, C: TypeRoles, holdMid: TYPE.inEnd + s(TYPE.hold) / 2 },
  { name: "ui", dur: UI_DUR, C: UiScene, holdMid: UI.inEnd + s(UI.hold) / 2 },
  { name: "init", dur: INIT_DUR, C: Init, holdMid: INIT.inEnd + s(INIT.hold) / 2 },
  { name: "use", dur: USE_DUR, C: Use, holdMid: USE.inEnd + s(USE.hold) / 2 },
  { name: "proof", dur: PROOF_DUR, C: Proof, holdMid: PROOF.inEnd + s(PROOF.hold) / 2 },
];

export const TOTAL = SCENES.reduce((a, x) => a + x.dur, 0);
