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

const trendSymbols = {
  up: "↑",
  down: "↓",
  neutral: "•",
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
    <div
      className={cn(
        "card card-hover rounded-[1.15rem] border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),rgba(11,15,24,0.68)] p-5",
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {title}
        </p>
        {icon && <div className="text-zinc-600">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <p className={cn("font-mono text-[1.85rem] font-bold tracking-[-0.04em]", colorClasses[color])}>
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-zinc-500"
            )}
          >
            {trendSymbols[trend]}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-2 text-xs leading-5 text-zinc-400">{subtitle}</p>}
    </div>
  );
}
