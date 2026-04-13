import React from "react";
import { SettingContainer } from "./SettingContainer";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isUpdating?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isUpdating = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  tooltipPosition = "top",
}) => {
  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      tooltipPosition={tooltipPosition}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled || isUpdating}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 ${disabled || isUpdating ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "#1A3D2B" : "#E8E8E8",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#FFFFFF",
            transition: "left 0.2s",
          }}
        />
      </button>
    </SettingContainer>
  );
};
