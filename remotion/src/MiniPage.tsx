import React from "react";
import { SANS } from "./theme";
import { useTheme } from "./lib";

/**
 * One page, laid out in drawn px and rendered the way the engine would:
 * layout × u (--fluid), header × ui (--fluid-ui), headline × disp (--fluid-display).
 * `fixed` renders the same design in plain px (u = ui = disp = 1, nothing fits).
 * W×H is the window in CSS px; k maps CSS px to diagram px.
 */
export type PageProps = {
  W: number;
  H: number;
  k: number;
  u: number;
  ui?: number;
  disp?: number;
  fixed?: boolean;
  /** outline the header in accent (scene 6) */
  markHeader?: boolean;
};

export const DesktopPage: React.FC<PageProps> = ({ W, H, k, u, ui = u, disp = u, fixed, markHeader }) => {
  const t = useTheme();
  const U = fixed ? 1 : u;
  const UI = fixed ? 1 : ui;
  const D = fixed ? 1 : disp;
  const cw = Math.min(W, 1680 * U); // fluid-container: 1680 drawn px max
  const cx = (W - cw) / 2;
  const pad = 80 * U;
  const x0 = cx + pad;
  const px = (v: number) => v * k;
  const leftW = 600 * U;
  const illX = x0 + leftW + 80 * U;
  const illW = fixed ? 600 : cw - 2 * pad - leftW - 80 * U;
  // the header's own container follows ui (its padding and height are ui units)
  const hcw = Math.min(W, 1680 * UI);
  const hx0 = (W - hcw) / 2 + 80 * UI;
  const hx1 = (W + hcw) / 2 - 80 * UI;
  const headH = (24 + 48) * UI;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: t.panel }}>
      {/* next section (below the 900-tall hero) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: px(900 * U),
          height: px(4000),
          background: t.codeBg,
          borderTop: `1px solid ${t.line}`,
        }}
      />
      {/* header */}
      <div
        style={{
          position: "absolute",
          left: px(hx0 - 16 * UI),
          width: px(hx1 - hx0 + 32 * UI),
          top: px(16 * UI),
          height: px(headH - 8 * UI),
          borderRadius: 6,
          outline: markHeader ? `2px solid ${t.accent}` : "none",
          background: markHeader ? t.amberBg : "transparent",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px(hx0),
          top: px(24 * UI + 12 * UI),
          width: px(24 * UI),
          height: px(24 * UI),
          borderRadius: px(6 * UI),
          background: t.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px(hx0 + 36 * UI),
          top: px(24 * UI + 18 * UI),
          width: px(96 * UI),
          height: px(12 * UI),
          borderRadius: 99,
          background: t.ink,
          opacity: 0.8,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(hx1 - 150 * UI - (3 - i) * 100 * UI),
            top: px(24 * UI + 19 * UI),
            width: px(70 * UI),
            height: px(10 * UI),
            borderRadius: 99,
            background: t.muted,
            opacity: 0.6,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: px(hx1 - 124 * UI),
          top: px(24 * UI + 6 * UI),
          width: px(124 * UI),
          height: px(36 * UI),
          borderRadius: 99,
          border: `${Math.max(1, px(2 * UI))}px solid ${t.ink}`,
          boxSizing: "border-box",
        }}
      />

      {/* hero copy */}
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(230 * U),
          width: px(leftW + 200),
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: px(64 * D),
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: t.ink,
          whiteSpace: "nowrap",
        }}
      >
        Every screen,
        <br />
        exactly as drawn.
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(x0),
            top: px((430 + i * 34) * U),
            width: px((i === 2 ? 340 : 520) * U),
            height: px(14 * U),
            borderRadius: 99,
            background: t.muted,
            opacity: 0.45,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(560 * U),
          width: px(200 * U),
          height: px(56 * U),
          borderRadius: 99,
          background: t.accent,
        }}
      />
      {/* illustration */}
      <div
        style={{
          position: "absolute",
          left: px(illX),
          top: px(170 * U),
          width: px(illW),
          height: px(560 * U),
          borderRadius: px(24 * U),
          background: t.amberBg,
          border: `1px solid ${t.line}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "18%",
            top: "20%",
            width: px(220 * U),
            height: px(220 * U),
            borderRadius: "50%",
            background: t.accent,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "46%",
            top: "46%",
            width: px(240 * U),
            height: px(160 * U),
            borderRadius: px(16 * U),
            background: t.dim,
            opacity: 0.75,
          }}
        />
      </div>
      {/* stat row at the foot of the hero */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(x0 + i * 220 * U),
            top: px(780 * U),
            width: px(180 * U),
            height: px(56 * U),
            borderRadius: px(12 * U),
            border: `1px solid ${t.line}`,
            background: t.bg,
          }}
        />
      ))}
    </div>
  );
};

/** The phone design (390 artboard); tablet and landscape render it scaled, in a 560-drawn-px column. */
export const PhonePage: React.FC<PageProps> = ({ W, k, u }) => {
  const t = useTheme();
  const cw = Math.min(W, 560 * u);
  const cx = (W - cw) / 2;
  const pad = 24 * u;
  const x0 = cx + pad;
  const inner = cw - 2 * pad;
  const px = (v: number) => v * k;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: t.panel }}>
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(20 * u),
          width: px(22 * u),
          height: px(22 * u),
          borderRadius: px(5 * u),
          background: t.accent,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(x0 + inner - 22 * u),
            top: px((24 + i * 7) * u),
            width: px(22 * u),
            height: px(3 * u),
            background: t.ink,
            opacity: 0.8,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(96 * u),
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: px(38 * u),
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          color: t.ink,
          whiteSpace: "nowrap",
        }}
      >
        Every screen,
        <br />
        as drawn.
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(x0),
            top: px((206 + i * 24) * u),
            width: px(i === 2 ? inner * 0.6 : inner),
            height: px(10 * u),
            borderRadius: 99,
            background: t.muted,
            opacity: 0.45,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(296 * u),
          width: px(160 * u),
          height: px(48 * u),
          borderRadius: 99,
          background: t.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px(x0),
          top: px(372 * u),
          width: px(inner),
          height: px(300 * u),
          borderRadius: px(20 * u),
          background: t.amberBg,
          border: `1px solid ${t.line}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "14%",
            top: "16%",
            width: px(130 * u),
            height: px(130 * u),
            borderRadius: "50%",
            background: t.accent,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "44%",
            top: "44%",
            width: px(150 * u),
            height: px(110 * u),
            borderRadius: px(12 * u),
            background: t.dim,
            opacity: 0.75,
          }}
        />
      </div>
    </div>
  );
};

/** A browser window of W×H CSS px drawn at scale k, with a thin chrome bar above the viewport. */
export const BrowserWindow: React.FC<{
  W: number;
  H: number;
  k: number;
  children: React.ReactNode;
  chrome?: boolean;
  radius?: number;
  overflowBelow?: React.ReactNode;
}> = ({ W, H, k, children, chrome = true, radius = 10, overflowBelow }) => {
  const t = useTheme();
  const bar = chrome ? 18 : 0;
  return (
    <div style={{ position: "relative", width: W * k, height: H * k + bar }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          border: `2px solid ${t.line}`,
          background: t.panel,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {chrome ? (
          <div
            style={{
              height: bar,
              background: t.codeBg,
              borderBottom: `1px solid ${t.line}`,
              display: "flex",
              alignItems: "center",
              gap: 5,
              paddingLeft: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: 99, background: t.glyph, opacity: 0.6 }} />
            ))}
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 0, right: 0, top: bar, bottom: 0 }}>{children}</div>
      </div>
      {overflowBelow}
    </div>
  );
};
