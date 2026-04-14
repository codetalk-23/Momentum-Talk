import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "../../ui/SettingsGroup";

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.about.title")}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 18px" }}
        >
          <span className="text-sm font-medium text-near-black">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            Momentum Talk
          </span>
          <span className="text-sm text-gray-500">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            v1.24
          </span>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Momentum">
        <div style={{ padding: "14px 18px" }} className="space-y-2">
          <p className="text-sm text-near-black">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            Momentum is een AI implementatiepartner voor het Nederlandse MKB. 
          </p>
          <a
            href="https://www.momentumai.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            www.momentumai.nl
          </a>
        </div>
      </SettingsGroup>
    </div>
  );
};
