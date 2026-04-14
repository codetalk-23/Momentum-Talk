import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "transcribing" | "processing";

const BAR_COUNT = 11;

const RecordingOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [levels, setLevels] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const energyRef = useRef<number>(0.4); // smoothed volume energy from mic
  const idleAnimRef = useRef<number | null>(null);
  const phaseRef = useRef<number[]>(
    Array(BAR_COUNT).fill(0).map((_, i) => i * 0.65),
  );
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    const tick = () => {
      if (state === "recording" && isVisible) {
        const t = Date.now() / 1000;
        const energy = energyRef.current;

        const animated = Array(BAR_COUNT).fill(0).map((_, i) => {
          phaseRef.current[i] += 0.035 + i * 0.004;
          const phase = phaseRef.current[i];

          // Natural wave: sum of sines at different frequencies per bar
          const wave =
            Math.sin(t * 2.8 + phase) * 0.45 +
            Math.sin(t * 5.2 + phase * 1.4) * 0.3 +
            Math.sin(t * 1.9 + i * 1.1) * 0.25;

          // Normalize 0–1, scale by energy so quiet = gentle idle, loud = big waves
          const normalized = (wave + 1) / 2;
          const target = Math.max(0.08, normalized * energy);

          smoothedLevelsRef.current[i] =
            smoothedLevelsRef.current[i] * 0.6 + target * 0.4;
          return smoothedLevelsRef.current[i];
        });

        setLevels([...animated]);
      }
      idleAnimRef.current = requestAnimationFrame(tick);
    };

    idleAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (idleAnimRef.current) cancelAnimationFrame(idleAnimRef.current);
    };
  }, [state, isVisible]);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        setState(event.payload as OverlayState);
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        // Compute RMS-like energy from all incoming values
        const sum = newLevels.reduce((a, b) => a + Math.abs(b), 0);
        const raw = newLevels.length > 0 ? sum / newLevels.length : 0;
        // Amplify moderately and clamp — quiet voice ~0.02 becomes ~0.4
        const amplified = Math.min(1, raw * 20);
        // Smooth energy so it doesn't jump around
        energyRef.current = energyRef.current * 0.7 + amplified * 0.3;
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
      };
    };

    setupEventListeners();
  }, []);

  return (
    <div
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""}`}
    >
      {state === "recording" && (
        <div className="overlay-pill overlay-pill--recording">
          <div className="bars-container">
            {levels.map((v, i) => (
              <div
                key={i}
                className="bar"
                style={{
                  height: `${4 + v * 24}px`,
                  opacity: 0.25 + v * 0.75,
                }}
              />
            ))}
          </div>
          <div
            className="cancel-button"
            onMouseDown={(e) => {
              e.preventDefault();
              commands.cancelOperation();
            }}
          />
        </div>
      )}

      {(state === "transcribing" || state === "processing") && (
        <div className="overlay-pill">
          <div className="transcribing-dots">
            <span /><span /><span />
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingOverlay;
