import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { SettingsGroup } from "../../ui/SettingsGroup";

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("—");
      }
    };
    fetchVersion();
  }, []);

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
          <span
            className="text-sm font-medium text-dark-grey"
            style={{
              background: "#F5F4F0",
              border: "1px solid #E8E8E8",
              borderRadius: 5,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            v{version}
          </span>
        </div>
      </SettingsGroup>
    </div>
  );
};
