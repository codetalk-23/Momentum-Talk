import React from "react";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  descriptionMode = "tooltip",
  grouped = false,
  layout = "horizontal",
  disabled = false,
}) => {
  const rowStyle = { padding: "14px 18px" };

  const containerClasses = grouped
    ? "hover:bg-warm-grey/30 transition-colors duration-150"
    : "rounded-lg border border-border-color bg-white";

  if (layout === "stacked") {
    return (
      <div className={containerClasses} style={grouped ? { ...rowStyle, borderRadius: 6 } : { ...rowStyle, borderRadius: 8 }}>
        <div className="mb-2">
          <h3 className={`text-sm font-medium text-text ${disabled ? "opacity-50" : ""}`}>
            {title}
          </h3>
          {descriptionMode === "inline" && (
            <p className={`text-sm text-dark-grey ${disabled ? "opacity-50" : ""}`}>
              {description}
            </p>
          )}
        </div>
        <div className="w-full">{children}</div>
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div
      className={`flex items-center justify-between ${containerClasses}`}
      style={grouped ? { ...rowStyle, borderRadius: 6 } : { ...rowStyle, borderRadius: 8 }}
    >
      <div className="max-w-2/3">
        <h3 className={`text-sm font-medium text-text ${disabled ? "opacity-50" : ""}`}>
          {title}
        </h3>
        {descriptionMode === "inline" && (
          <p className={`text-sm text-dark-grey ${disabled ? "opacity-50" : ""}`}>
            {description}
          </p>
        )}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
};
