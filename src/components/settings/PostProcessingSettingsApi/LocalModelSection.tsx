import React from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { SettingContainer } from "@/components/ui";
import ProgressBar from "../../shared/ProgressBar";
import { useLocalLlm } from "./useLocalLlm";

/**
 * Download / manage UI for the built-in local formatting model, shown when
 * the "Local (built-in)" post-processing provider is selected.
 */
const LocalModelSectionComponent: React.FC = () => {
  const { t } = useTranslation();
  const {
    status,
    phase,
    progress,
    error,
    download,
    cancelDownload,
    deleteModel,
  } = useLocalLlm(true);

  if (status && !status.is_supported) {
    return (
      <Alert variant="error" contained>
        {t("settings.postProcessing.api.localLlm.unsupported")}
      </Alert>
    );
  }

  const totalSizeMb =
    (status?.model?.size_mb ?? 0) + (status?.runtime?.size_mb ?? 0);
  const isBusy = phase !== "idle";

  return (
    <SettingContainer
      title={t("settings.postProcessing.api.localLlm.title")}
      description={t("settings.postProcessing.api.localLlm.description")}
      descriptionMode="tooltip"
      layout="horizontal"
      grouped={true}
    >
      <div className="flex items-center gap-3">
        {error && (
          <span
            className="text-xs text-red-500 max-w-[280px] truncate"
            title={error}
          >
            {error}
          </span>
        )}

        {status?.is_available ? (
          <>
            <span className="text-sm text-text/70">
              {t("settings.postProcessing.api.localLlm.downloaded")}
            </span>
            <Button
              onClick={() => void deleteModel()}
              variant="secondary"
              size="md"
            >
              {t("settings.postProcessing.api.localLlm.delete")}
            </Button>
          </>
        ) : isBusy ? (
          <>
            {phase === "downloading" ? (
              <ProgressBar
                progress={[{ id: "local-llm", percentage: progress }]}
                size="large"
                showLabel
              />
            ) : (
              <span className="text-sm text-text/70">
                {phase === "verifying"
                  ? t("settings.postProcessing.api.localLlm.verifying")
                  : t("settings.postProcessing.api.localLlm.extracting")}
              </span>
            )}
            <Button
              onClick={() => void cancelDownload()}
              variant="secondary"
              size="md"
              disabled={phase !== "downloading"}
            >
              {t("settings.postProcessing.api.localLlm.cancel")}
            </Button>
          </>
        ) : (
          <Button onClick={() => void download()} variant="primary" size="md">
            {t("settings.postProcessing.api.localLlm.download", {
              size: totalSizeMb,
            })}
          </Button>
        )}
      </div>
    </SettingContainer>
  );
};

export const LocalModelSection = React.memo(LocalModelSectionComponent);
LocalModelSection.displayName = "LocalModelSection";
