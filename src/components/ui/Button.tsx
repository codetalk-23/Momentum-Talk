import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-lg border focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variantClasses = {
    primary:
      "text-white bg-accent border-accent hover:bg-accent-secondary hover:border-accent-secondary focus:ring-1 focus:ring-accent",
    "primary-soft":
      "text-text bg-accent/10 border-accent/20 hover:bg-accent/15 focus:ring-1 focus:ring-accent/30",
    secondary:
      "bg-border-color border-border-color text-text hover:bg-background-secondary hover:border-border-color focus:outline-none",
    danger:
      "text-white bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 focus:ring-1 focus:ring-red-500",
    "danger-ghost":
      "text-red-600 border-transparent hover:text-red-700 hover:bg-red-50 focus:bg-red-100",
    ghost:
      "text-text border-border-color hover:bg-border-color/40 hover:border-border-color focus:bg-border-color/60",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-[5px] text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
