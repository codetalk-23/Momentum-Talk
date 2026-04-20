import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { SettingsGroup } from "../../ui/SettingsGroup";

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.about.title")}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 18px" }}
        >
          <span className="text-sm font-medium text-near-black">
            {t("settings.about.appName")}
          </span>
          <span className="text-sm text-gray-500">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            v{version}
          </span>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.about.momentum.title")}>
        <div style={{ padding: "14px 18px" }} className="space-y-2">
          <p className="text-sm text-near-black">
            {t("settings.about.momentum.description")}
          </p>
          <a
            href="https://www.momentumai.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            {t("settings.about.momentum.website")}
          </a>
        </div>
      </SettingsGroup>
    </div>
  );
};
