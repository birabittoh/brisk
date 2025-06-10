// GradientButton.tsx
import React from "react";

type ButtonColor = "gray" | "red" | "green" | "blue";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColor;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const colorClasses: Record<ButtonColor, string> = {
  gray: "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700",
  red: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
  green: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
  blue: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
};

const GradientButton: React.FC<GradientButtonProps> = ({
  color = "gray",
  fullWidth = false,
  children,
  className = "",
  ...props
}) => {
  return (
    <button
      className={`
        ${colorClasses[color]}
        text-white px-6 py-3 rounded-xl font-semibold
        transition-all transform hover:scale-105
        ${fullWidth ? "w-full py-4 text-lg" : ""}
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default GradientButton;
