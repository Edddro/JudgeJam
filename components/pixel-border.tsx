import type React from "react"

interface PixelBorderProps {
  children: React.ReactNode
  className?: string
  variant?: "small" | "medium" | "large"
  color?: "light" | "medium" | "dark" | "purple" | "teal"
}

export default function PixelBorder({
  children,
  className = "",
  variant = "medium",
  color = "medium",
}: PixelBorderProps) {
  const colorClasses = {
    light: "border-light-blue",
    medium: "border-medium-blue",
    dark: "border-dark-blue",
    purple: "border-purple-accent",
    teal: "border-teal-accent",
  }

  const borderWidth = {
    small: "border-4",
    medium: "border-6",
    large: "border-8",
  }

  const shadowSize = {
    small: "shadow-[4px_4px_0px_0px_rgba(62,92,118,0.5)]",
    medium: "shadow-[6px_6px_0px_0px_rgba(62,92,118,0.5)]",
    large: "shadow-[8px_8px_0px_0px_rgba(62,92,118,0.5)]",
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          ${borderWidth[variant]} 
          ${colorClasses[color]} 
          ${shadowSize[variant]} 
          pixel-border-element
        `}
      >
        {children}
      </div>
    </div>
  )
}
