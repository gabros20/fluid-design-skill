import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { themes, type ThemeName } from "./theme";
import { ThemeProvider } from "./lib";
import { SCENES } from "./scenes";

// The fluid-design explainer: nine scenes played back to back (see ../STORYBOARD.md).
// Each scene starts and ends on the bare background, so the loop seam is invisible.
export const HeroAnimation: React.FC<{ theme: ThemeName }> = ({ theme }) => {
  const t = themes[theme];
  return (
    <ThemeProvider value={t}>
      <AbsoluteFill style={{ backgroundColor: t.bg }}>
        <Series>
          {SCENES.map(({ name, dur, C }) => (
            <Series.Sequence key={name} name={name} durationInFrames={dur} premountFor={30}>
              <C />
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
