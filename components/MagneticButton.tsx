"use client";

import { useRef, useState, ReactNode } from "react";
import Link from "next/link";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  icon?: ReactNode;
}

export default function MagneticButton({
  children,
  href,
  external = false,
  onClick,
  variant = "primary",
  className = "",
  icon,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * 0.25;
    const deltaY = (e.clientY - centerY) * 0.25;
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);

  const variantClasses = {
    primary: "mag-btn-primary",
    secondary: "mag-btn-secondary",
    ghost: "mag-btn-ghost",
  };

  const style: React.CSSProperties = {
    transform: `translate(${position.x}px, ${position.y}px) translateY(${
      isPressed ? "2px" : isHovered ? "-6px" : "0px"
    }) scale(${isPressed ? 0.95 : isHovered ? 1.05 : 1})`,
    transition: isHovered
      ? "transform 0.12s ease-out, box-shadow 0.3s ease"
      : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease",
    boxShadow: isHovered
      ? "0 12px 35px rgba(0, 0, 0, 0.4), 0 4px 15px rgba(139, 92, 246, 0.2)"
      : "none",
  };

  const content = (
    <div
      ref={ref}
      className={`mag-btn ${variantClasses[variant]} ${isHovered ? "mag-btn-hovered" : ""} ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={onClick}
    >
      <span className="mag-btn-bg" />
      <span className="mag-btn-content">
        {isHovered && (
          <span className="mag-btn-arrow">→</span>
        )}
        <span>{children}</span>
        {icon && <span className="mag-btn-icon">{icon}</span>}
      </span>
      {isHovered && <span className="mag-btn-glow" />}
    </div>
  );

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block">
        {content}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
