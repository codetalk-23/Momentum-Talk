import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefresh?: () => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  placeholder = "Select an option...",
  disabled = false,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && onRefresh) onRefresh();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const maxMenuHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const opensUpward = spaceBelow < maxMenuHeight + 4;
      setMenuStyle(
        opensUpward
          ? {
              position: "fixed",
              bottom: window.innerHeight - rect.top + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }
          : {
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            },
      );
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`px-2 py-1 text-sm font-semibold bg-background border border-border-color rounded-md min-w-[200px] text-start flex items-center justify-between transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-background-secondary cursor-pointer hover:border-accent"
        }`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <svg
          className={`w-4 h-4 ms-2 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              ...menuStyle,
              background: "#FFFFFF",
              border: "1px solid #E5E5EA",
              borderRadius: 6,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {options.length === 0 ? (
              <div className="px-2 py-1 text-sm text-dark-grey">
                {t("common.noOptionsFound")}
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`w-full px-2 py-1 text-sm text-start hover:bg-background-secondary transition-colors duration-150 ${
                    selectedValue === option.value
                      ? "bg-accent/10 font-semibold text-accent"
                      : ""
                  } ${option.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
