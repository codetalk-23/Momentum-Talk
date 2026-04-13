import React from "react";
import { SettingContainer } from "./SettingContainer";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  description: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  label,
  description,
  descriptionMode = "tooltip",
  grouped = false,
  showValue = true,
  formatValue = (v) => v.toFixed(2),
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
      disabled={disabled}
    >
      <div className="w-full">
        <div className="flex items-center space-x-1 h-6">
          <style>{`
            input[type=range].mt-slider {
              -webkit-appearance: none;
              appearance: none;
              height: 3px;
              border-radius: 2px;
              outline: none;
              cursor: pointer;
            }
            input[type=range].mt-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 0;
              height: 0;
            }
            input[type=range].mt-slider::-moz-range-thumb {
              width: 0;
              height: 0;
              border: none;
            }
            input[type=range].mt-slider:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `}</style>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="mt-slider flex-grow"
            style={{
              background: `linear-gradient(to right, #1A3D2B ${
                ((value - min) / (max - min)) * 100
              }%, #E8E8E8 ${
                ((value - min) / (max - min)) * 100
              }%)`,
            }}
          />
          {showValue && (
            <span className="text-sm font-medium text-text/90 w-12 text-end">
              {formatValue(value)}
            </span>
          )}
        </div>
      </div>
    </SettingContainer>
  );
};
