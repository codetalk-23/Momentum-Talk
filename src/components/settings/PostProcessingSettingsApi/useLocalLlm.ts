import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { commands, type LocalLlmStatus } from "@/bindings";

type LocalLlmPhase = "idle" | "downloading" | "verifying" | "extracting";

interface DownloadProgressPayload {
  model_id: string;
  downloaded: number;
  total: number;
  percentage: number;
}

interface LocalLlmState {
  status: LocalLlmStatus | null;
  phase: LocalLlmPhase;
  progress: number;
  error: string | null;
  download: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
}

/**
 * State for the built-in local post-processing model: download status of the
 * GGUF + llama-server runtime pair, live progress, and manage actions.
 * The two model ids are intentionally not tracked by the modelStore (they are
 * filtered out of `get_available_models`), so this hook listens to the global
 * model events directly.
 */
export const useLocalLlm = (enabled: boolean): LocalLlmState => {
  const [status, setStatus] = useState<LocalLlmStatus | null>(null);
  const [phase, setPhase] = useState<LocalLlmPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const idsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const result = await commands.getLocalLlmStatus();
    if (result.status === "ok") {
      setStatus(result.data);
      const ids = new Set<string>();
      if (result.data.model) ids.add(result.data.model.id);
      if (result.data.runtime) ids.add(result.data.runtime.id);
      idsRef.current = ids;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void refresh();

    const unlisteners: Promise<UnlistenFn>[] = [
      listen<DownloadProgressPayload>("model-download-progress", (event) => {
        if (!idsRef.current.has(event.payload.model_id)) return;
        setPhase("downloading");
        setProgress(event.payload.percentage);
      }),
      listen<string>("model-verification-started", (event) => {
        if (!idsRef.current.has(event.payload)) return;
        setPhase("verifying");
      }),
      listen<string>("model-extraction-started", (event) => {
        if (!idsRef.current.has(event.payload)) return;
        setPhase("extracting");
      }),
      listen<string>("model-download-complete", (event) => {
        if (!idsRef.current.has(event.payload)) return;
        setPhase("idle");
        setProgress(0);
        void refresh();
      }),
      listen<{ model_id: string; error: string }>(
        "model-download-failed",
        (event) => {
          if (!idsRef.current.has(event.payload.model_id)) return;
          setPhase("idle");
          setProgress(0);
          setError(event.payload.error);
          void refresh();
        },
      ),
      listen<string>("model-deleted", (event) => {
        if (!idsRef.current.has(event.payload)) return;
        void refresh();
      }),
    ];

    return () => {
      unlisteners.forEach((unlisten) => {
        void unlisten.then((fn) => fn());
      });
    };
  }, [enabled, refresh]);

  const download = useCallback(async () => {
    setError(null);
    setPhase("downloading");
    setProgress(0);
    const result = await commands.downloadLocalLlm();
    if (result.status === "error") {
      setError(result.error);
    }
    setPhase("idle");
    await refresh();
  }, [refresh]);

  const cancelDownload = useCallback(async () => {
    await commands.cancelLocalLlmDownload();
    setPhase("idle");
    setProgress(0);
    await refresh();
  }, [refresh]);

  const deleteModel = useCallback(async () => {
    setError(null);
    const result = await commands.deleteLocalLlm();
    if (result.status === "error") {
      setError(result.error);
    }
    await refresh();
  }, [refresh]);

  return {
    status,
    phase,
    progress,
    error,
    download,
    cancelDownload,
    deleteModel,
  };
};
