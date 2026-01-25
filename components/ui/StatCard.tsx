"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "green" | "red" | "purple" | "orange" | "cyan";
  className?: string;
}

const colorClasses = {
  blue: "text-blue-400",
  green: "text-emerald-400",
  red: "text-red-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
  cyan: "text-cyan-400",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "blue",
  className,
}: StatCardProps) {
  return (
    <div className={cn("card p-5 card-hover", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        {icon && <div className="text-zinc-600">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <p className={cn("text-2xl font-bold font-mono", colorClasses[color])}>
          {value}
        </p>
        {trend && (
          <span className={cn(
            "text-xs font-medium",
            trend === "up" && "text-emerald-400",
            trend === "down" && "text-red-400",
            trend === "neutral" && "text-zinc-500"
          )}>
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
