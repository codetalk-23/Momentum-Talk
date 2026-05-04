import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { commands } from "@/bindings";
import { useFileTranscribeStore } from "@/stores/fileTranscribeStore";

type Stage = "decoding" | "loading_model" | "transcribing";

interface ProgressEvent {
  progress: number;
  partial_text: string;
  stage: Stage;
}

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"]);

export const FileTranscribeSettings: React.FC = () => {
  const { t } = useTranslation();

  // Persistent across navigation
  const { filePath, fileName, streamText, result, setFile, setStreamText, setResult, reset } =
    useFileTranscribeStore();

  // Ephemeral — only needed while the component is mounted
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>("decoding");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [streamText]);

  const applyFile = (path: string) => {
    const name = path.split("/").pop() ?? path.split("\\").pop() ?? path;
    setFile(path, name);
    setResult(null);
    setStreamText("");
    setError(null);
    setProgress(0);
  };

  // Use Tauri's drag-drop event to get the real native file path
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          if (!transcribing) setDragOver(true);
        } else if (event.payload.type === "leave") {
          setDragOver(false);
        } else if (event.payload.type === "drop") {
          setDragOver(false);
          if (transcribing) return;
          const paths: string[] = event.payload.paths ?? [];
          const path = paths[0];
          if (!path) return;
          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          if (!AUDIO_EXTENSIONS.has(ext)) {
            setError(t("fileTranscribe.unsupportedFormat"));
            return;
          }
          applyFile(path);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcribing]);

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"],
        },
      ],
    });
    if (!selected) return;
    applyFile(selected);
  };

  const handleTranscribe = async () => {
    if (!filePath) return;
    setTranscribing(true);
    setError(null);
    setResult(null);
    setStreamText("");
    setProgress(0);
    setStage("decoding");

    const unlisten = await listen<ProgressEvent>(
      "file-transcription-progress",
      (event) => {
        setProgress(event.payload.progress);
        setStreamText(event.payload.partial_text);
        if (event.payload.stage) setStage(event.payload.stage);
      },
    );
    unlistenRef.current = unlisten;

    try {
      const res = await commands.transcribeFile(filePath);
      if (res.status === "ok") {
        setResult(res.data);
        setStreamText(res.data);
        setProgress(100);
      } else {
        const err = res.error as string;
        if (err !== "Cancelled") setError(err);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      unlisten();
      unlistenRef.current = null;
      setTranscribing(false);
    }
  };

  const handleCancel = async () => {
    await commands.cancelFileTranscription();
  };

  const handleCopy = async () => {
    const text = result ?? streamText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = result ?? streamText;
    if (!text) return;
    const baseName = fileName ? fileName.replace(/\.[^.]+$/, "") : "transcription";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showOutput = transcribing || result !== null || streamText.length > 0;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-border-color bg-white overflow-hidden">
        {/* Drop zone */}
        <div
          className={`px-5 py-6 border-b border-border-color transition-colors ${dragOver ? "bg-warm-grey" : "bg-white"}`}
        >
          <p className="text-xs text-dark-grey mb-4">{t("fileTranscribe.description")}</p>
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition-colors cursor-default ${dragOver ? "border-near-black bg-warm-grey" : "border-border-color"}`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-dark-grey">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {fileName ? (
              <div className="flex items-center gap-1.5 max-w-xs">
                <span className="text-sm font-medium text-near-black truncate" title={fileName}>{fileName}</span>
                <button
                  onClick={() => { reset(); setError(null); setProgress(0); }}
                  disabled={transcribing}
                  className="flex-shrink-0 text-dark-grey hover:text-near-black disabled:opacity-40 transition-colors"
                  aria-label="Remove file"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <span className="text-sm text-dark-grey">{t("fileTranscribe.dropOrSelect")}</span>
            )}
            <button
              onClick={handleSelectFile}
              disabled={transcribing}
              className="mt-1 text-xs font-medium px-4 py-1.5 rounded-lg border border-border-color bg-white hover:bg-warm-grey disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-near-black"
            >
              {filePath ? t("fileTranscribe.changeFile") : t("fileTranscribe.selectFile")}
            </button>
          </div>
          <p className="text-xs text-dark-grey mt-2">{t("fileTranscribe.supportedFormats")}</p>
        </div>

        {/* Action row */}
        <div className="px-5 py-3 flex items-center gap-3">
          {!transcribing ? (
            <button
              onClick={handleTranscribe}
              disabled={!filePath}
              className={`text-sm font-medium px-5 py-2 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${filePath ? "bg-green-700 hover:bg-green-800" : "bg-near-black hover:bg-black"}`}
            >
              {t("fileTranscribe.transcribe")}
            </button>
          ) : (
            <>
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-warm-grey rounded-full overflow-hidden relative">
                  {stage === "transcribing" ? (
                    <div
                      className="h-full bg-near-black rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(progress, 1)}%` }}
                    />
                  ) : (
                    <div className="absolute inset-0 file-transcribe-indeterminate" />
                  )}
                </div>
                <span className="text-sm text-dark-grey whitespace-nowrap">
                  {stage === "decoding"
                    ? t("fileTranscribe.stageDecoding")
                    : stage === "loading_model"
                      ? t("fileTranscribe.stageLoadingModel")
                      : `${t("fileTranscribe.transcribing").replace("…", "")} ${Math.round(progress)}%`}
                </span>
              </div>
              <button
                onClick={handleCancel}
                className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                {t("fileTranscribe.cancel")}
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pb-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Streaming / result output */}
      {showOutput && (
        <div className="rounded-xl border border-border-color bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-color flex items-center justify-between">
            <span
              className="font-semibold uppercase text-dark-grey"
              style={{ fontSize: 9, letterSpacing: "2px" }}
            >
              {t("fileTranscribe.result")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!streamText && !result}
                className="text-xs px-3 py-1 rounded-md border border-border-color bg-white hover:bg-warm-grey disabled:opacity-40 transition-colors text-near-black"
              >
                {copied ? t("fileTranscribe.copied") : t("fileTranscribe.copy")}
              </button>
              <button
                onClick={handleDownload}
                disabled={!streamText && !result}
                className="text-xs px-3 py-1 rounded-md border border-border-color bg-white hover:bg-warm-grey disabled:opacity-40 transition-colors text-near-black"
              >
                {t("fileTranscribe.download")}
              </button>
            </div>
          </div>

          <textarea
            ref={textAreaRef}
            readOnly
            value={streamText}
            rows={14}
            className="w-full text-sm bg-transparent px-5 py-4 resize-none text-near-black focus:outline-none leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};
