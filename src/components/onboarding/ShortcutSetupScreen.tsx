import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import { useOsType } from "@/hooks/useOsType";
import {
  formatKeyCombination,
  getKeyName,
  normalizeKey,
} from "@/lib/utils/keyboard";
import { toast } from "sonner";

interface ShortcutSetupScreenProps {
  onComplete: () => void;
}

const SHORTCUT_ID = "transcribe";

const ShortcutSetupScreen: React.FC<ShortcutSetupScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { getSetting, updateBinding } = useSettings();
  const osType = useOsType();
  const [isRecording, setIsRecording] = useState(false);
  const [keyPressed, setKeyPressed] = useState<string[]>([]);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const captureRef = useRef<HTMLDivElement | null>(null);

  const bindings = getSetting("bindings") || {};
  const binding = bindings[SHORTCUT_ID];
  const currentLabel = binding?.current_binding
    ? formatKeyCombination(binding.current_binding, osType)
    : null;

  const startRecording = async () => {
    if (isRecording) return;
    await commands.suspendBinding(SHORTCUT_ID).catch(console.error);
    setIsRecording(true);
    setKeyPressed([]);
    setRecordedKeys([]);
  };

  useEffect(() => {
    if (!isRecording) return;

    let cleanup = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (cleanup) return;
      if (e.repeat) return;
      e.preventDefault();
      const key = normalizeKey(getKeyName(e, osType));
      setKeyPressed((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setRecordedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (cleanup) return;
      e.preventDefault();
      const key = normalizeKey(getKeyName(e, osType));
      const updatedPressed = keyPressed.filter((k) => k !== key);
      setKeyPressed(updatedPressed);

      if (updatedPressed.length === 0 && recordedKeys.length > 0) {
        const modifiers = ["ctrl","control","shift","alt","option","meta","command","cmd","super","win","windows"];
        const sorted = [...recordedKeys].sort((a, b) => {
          const aM = modifiers.includes(a.toLowerCase());
          const bM = modifiers.includes(b.toLowerCase());
          if (aM && !bM) return -1;
          if (!aM && bM) return 1;
          return 0;
        });
        const newShortcut = sorted.join("+");
        setIsRecording(false);
        try {
          await updateBinding(SHORTCUT_ID, newShortcut);
        } catch (err) {
          toast.error(t("settings.general.shortcut.errors.set", { error: String(err) }));
          await commands.resumeBinding(SHORTCUT_ID).catch(console.error);
        }
        setKeyPressed([]);
        setRecordedKeys([]);
      }
    };

    const handleClickOutside = async (e: MouseEvent) => {
      if (cleanup) return;
      if (captureRef.current && !captureRef.current.contains(e.target as Node)) {
        setIsRecording(false);
        setKeyPressed([]);
        setRecordedKeys([]);
        await commands.resumeBinding(SHORTCUT_ID).catch(console.error);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleClickOutside);

    return () => {
      cleanup = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [isRecording, keyPressed, recordedKeys, osType, updateBinding, t]);

  const displayLabel = isRecording
    ? recordedKeys.length > 0
      ? formatKeyCombination(recordedKeys.join("+"), osType)
      : t("onboarding.shortcut.pressKeys")
    : currentLabel;

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center px-8 gap-10"
      style={{ animation: "fade-in 0.5s ease-out forwards" }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-[22px] font-normal text-text tracking-tight">
          {t("onboarding.shortcut.title")}
        </h1>
        <p className="text-sm text-text/50 max-w-[260px] leading-relaxed">
          {t("onboarding.shortcut.subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <span className="text-[10px] font-normal text-text/40 uppercase tracking-widest">
          {t("onboarding.shortcut.currentLabel")}
        </span>
        <div
          ref={captureRef}
          onClick={startRecording}
          className="px-6 py-3 rounded-xl text-sm font-mono cursor-pointer select-none transition-all"
          style={{
            background: "#F5F4F0",
            border: isRecording ? "1px solid #1A3D2B" : "1px solid #E8E8E8",
            minWidth: 160,
            textAlign: "center",
            color: isRecording && recordedKeys.length === 0 ? "#888888" : "#0A0A0A",
          }}
        >
          {displayLabel || t("onboarding.shortcut.pressKeys")}
        </div>
        {isRecording && (
          <p className="text-[11px] text-text/40 text-center">
            {t("onboarding.shortcut.pressKeys")}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onComplete}
          disabled={isRecording}
          className="px-8 py-2.5 rounded-lg bg-background-secondary border border-border-color text-text text-sm font-normal transition-all cursor-pointer hover:bg-border-color active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("onboarding.shortcut.save")}
        </button>
        <button
          onClick={onComplete}
          disabled={isRecording}
          className="text-xs text-text/40 hover:text-text/60 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {t("onboarding.shortcut.keep")}
        </button>
      </div>
    </div>
  );
};

export default ShortcutSetupScreen;
