import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "@/hooks/useSettings";
import { useOsType } from "@/hooks/useOsType";
import { formatKeyCombination } from "@/lib/utils/keyboard";
import type { HistoryUpdatePayload } from "@/bindings";

interface TestScreenProps {
  onComplete: () => void;
}

const TestScreen: React.FC<TestScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const osType = useOsType();
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);

  const bindings = getSetting("bindings") || {};
  const transcribeBinding = bindings["transcribe"];
  const shortcutLabel = transcribeBinding?.current_binding
    ? formatKeyCombination(transcribeBinding.current_binding, osType)
    : null;

  useEffect(() => {
    const unlisten = listen<HistoryUpdatePayload>("history-update-payload", (event) => {
      if (event.payload.action === "added") {
        const text = event.payload.entry.transcription_text.trim();
        if (text) setTranscriptionResult(text);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center px-10 gap-8"
      style={{ animation: "fade-in 0.5s ease-out forwards", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif" }}
    >
      {/* Brand accent bar */}
      <div className="w-8 h-1 rounded-full" style={{ background: "#1A3D2B" }} />

      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[22px] font-normal" style={{ color: "#0A0A0A" }}>
          {t("onboarding.test.title")}
        </h1>
        <p className="text-sm leading-relaxed max-w-[300px]" style={{ color: "#888888" }}>
          {t("onboarding.test.subtitle")}{" "}
          {shortcutLabel && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-xs font-mono"
              style={{ background: "#F5F4F0", border: "1px solid #E8E8E8", color: "#888888" }}
            >
              {shortcutLabel}
            </span>
          )}{" "}
          {t("onboarding.test.subtitleSuffix")}
        </p>
      </div>

      {/* Example sentence */}
      <div
        className="w-full max-w-[360px] rounded-xl px-6 py-5 text-center"
        style={{ background: "#F5F4F0", border: "1px solid #E8E8E8" }}
      >
        {transcriptionResult ? (
          <p className="text-sm leading-relaxed" style={{ color: "#0A0A0A" }}>
            {transcriptionResult}
          </p>
        ) : (
          <p className="text-sm italic leading-relaxed" style={{ color: "#888888" }}>
            {t("onboarding.test.exampleSentence")}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onComplete}
          className="px-8 py-2.5 rounded-lg text-sm font-normal transition-all cursor-pointer active:scale-[0.98]"
          style={{ background: "#F5F4F0", border: "1px solid #E8E8E8", color: "#0A0A0A" }}
        >
          {t("onboarding.test.continueButton")}
        </button>
        <button
          onClick={onComplete}
          className="text-xs transition-colors cursor-pointer"
          style={{ color: "#888888" }}
        >
          {t("onboarding.test.skip")}
        </button>
      </div>
    </div>
  );
};

export default TestScreen;
