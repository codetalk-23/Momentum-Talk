import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import MomentumainlLogo from "../icons/MomentumainlLogo";
import { useModelStore } from "../../stores/modelStore";

const DEFAULT_MODEL_ID = "parakeet-tdt-0.6b-v3";

interface OnboardingProps {
  onModelSelected: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const { t } = useTranslation();
  const hasStartedDownload = useRef(false);
  const {
    models,
    downloadModel,
    selectModel,
    downloadingModels,
    verifyingModels,
    extractingModels,
    downloadProgress,
    downloadStats,
  } = useModelStore();

  // Start download automatically once models are loaded
  useEffect(() => {
    if (models.length === 0) return;
    const model = models.find((m) => m.id === DEFAULT_MODEL_ID);
    if (!model) return;
    if (model.is_downloaded) {
      selectModel(DEFAULT_MODEL_ID).then((success) => {
        if (success) onModelSelected();
        else toast.error(t("onboarding.errors.selectModel"));
      });
      return;
    }
    if (!hasStartedDownload.current) {
      hasStartedDownload.current = true;
      downloadModel(DEFAULT_MODEL_ID).catch(() => {
        toast.error(t("onboarding.errors.selectModel"));
      });
    }
  }, [models, downloadingModels, verifyingModels, extractingModels, downloadModel, selectModel, onModelSelected, t]);

  // Watch for download completion
  useEffect(() => {
    const model = models.find((m) => m.id === DEFAULT_MODEL_ID);
    if (!model?.is_downloaded) return;
    const stillBusy =
      DEFAULT_MODEL_ID in downloadingModels ||
      DEFAULT_MODEL_ID in verifyingModels ||
      DEFAULT_MODEL_ID in extractingModels;
    if (stillBusy) return;

    selectModel(DEFAULT_MODEL_ID).then((success) => {
      if (success) onModelSelected();
      else toast.error(t("onboarding.errors.selectModel"));
    });
  }, [
    models,
    downloadingModels,
    verifyingModels,
    extractingModels,
    selectModel,
    onModelSelected,
  ]);

  const isDownloading = DEFAULT_MODEL_ID in downloadingModels;
  const isVerifying = DEFAULT_MODEL_ID in verifyingModels;
  const isExtracting = DEFAULT_MODEL_ID in extractingModels;
  const progressEntry = downloadProgress[DEFAULT_MODEL_ID];
  const progress = progressEntry?.percentage;
  const totalKnown = (progressEntry?.total ?? 0) > 0;
  const speed = downloadStats[DEFAULT_MODEL_ID]?.speed;

  const getStatusLabel = () => {
    if (isExtracting) return t("modelSelector.extractingGeneric");
    if (isVerifying) return t("modelSelector.verifyingGeneric");
    if (isDownloading && progress !== undefined && totalKnown)
      return t("modelSelector.downloading", {
        percentage: Math.round(progress),
      });
    return t("modelSelector.downloading", { percentage: 0 });
  };

  // Show real progress bar only when total size is known (server sent Content-Length)
  const showRealProgress = isDownloading && progress !== undefined && totalKnown;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="flex flex-col items-center gap-2">
        <MomentumainlLogo width={200} />
      </div>

      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        {showRealProgress ? (
          <>
            <div className="w-full h-1.5 bg-border-color rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between w-full text-sm text-text/60">
              <span>{getStatusLabel()}</span>
              {speed !== undefined && speed > 0 && (
                <span className="tabular-nums">
                  {t("modelSelector.downloadSpeed", {
                    speed: speed.toFixed(1),
                  })}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="w-full h-1.5 bg-border-color rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse w-full" />
            </div>
            <div className="flex items-center gap-2 text-sm text-text/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{getStatusLabel()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
