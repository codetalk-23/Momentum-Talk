import React from "react";
import { useTranslation } from "react-i18next";
import MomentumainlLogo from "./icons/MomentumainlLogo";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  DebugSettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface SectionConfig {
  labelKey: string;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
  visibleInNav: boolean;
}

export const SECTIONS_CONFIG = {
  general: {
    labelKey: "sidebar.general",
    component: GeneralSettings,
    enabled: (_?: any) => true,
    visibleInNav: true,
  },
  models: {
    labelKey: "sidebar.models",
    component: ModelsSettings,
    enabled: (_?: any) => true,
    visibleInNav: false,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    component: AdvancedSettings,
    enabled: (_?: any) => true,
    visibleInNav: true,
  },
  history: {
    labelKey: "sidebar.history",
    component: HistorySettings,
    enabled: (_?: any) => true,
    visibleInNav: true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
    visibleInNav: false,
  },
  debug: {
    labelKey: "sidebar.debug",
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
    visibleInNav: false,
  },
  about: {
    labelKey: "sidebar.about",
    component: AboutSettings,
    enabled: (_?: any) => true,
    visibleInNav: true,
  },
} satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const navSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.visibleInNav && config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div
      className="flex flex-col h-full border-e border-border-color bg-white"
      style={{ width: 200, minWidth: 200 }}
    >
      <div className="px-5 py-5 border-b border-border-color">
        <MomentumainlLogo width={110} />
      </div>
      <nav className="flex flex-col gap-0.5 px-3 pt-4">
        {navSections.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-2.5 w-full text-start px-3 py-2 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? "bg-warm-grey text-near-black font-semibold"
                  : "text-dark-grey font-normal hover:bg-warm-grey/60"
              }`}
            >
              {isActive && (
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: "#2D6A4F",
                  }}
                />
              )}
              {!isActive && <span style={{ width: 6, height: 6, flexShrink: 0 }} />}
              <span className="text-sm truncate">{t(section.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
