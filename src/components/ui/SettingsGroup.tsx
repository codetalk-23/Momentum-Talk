import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="space-y-2">
      {title && (
        <div className="px-1">
          <h2
            className="font-bold uppercase text-forest"
            style={{ fontSize: 9, letterSpacing: "2px" }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-xs text-dark-grey mt-1">{description}</p>
          )}
        </div>
      )}
      <div
        className="bg-white overflow-visible"
        style={{ border: "1px solid #E8E8E8", borderRadius: 8 }}
      >
        <div className="divide-y divide-border-color">{children}</div>
      </div>
    </div>
  );
};
