"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { MODEL_COLORS } from "@/lib/constants";
import { parseModelsJson, type ModelInfo } from "@/lib/utils";

interface PriceChartProps {
  priceHistory: Record<string, Array<{ time: string; probability: number }>>;
  modelsJson?: unknown;
  height?: number;
}

export default function PriceChart({ priceHistory, modelsJson, height = 300 }: PriceChartProps) {
  const models = parseModelsJson(modelsJson);
  
  // Transform data for Recharts
  const chartData = useMemo(() => {
    const allTimes = new Set<string>();
    
    // Collect all unique timestamps
    Object.values(priceHistory).forEach((history) => {
      history.forEach((point) => allTimes.add(point.time));
    });
    
    // Sort timestamps
    const sortedTimes = Array.from(allTimes).sort();
    
    // Build data array with all models' values at each time
    return sortedTimes.map((time) => {
      const dataPoint: Record<string, any> = {
        time,
        displayTime: new Date(time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      
      Object.entries(priceHistory).forEach(([modelIdx, history]) => {
        // Find the closest point at or before this time
        const point = history.find((p) => p.time === time);
        if (point) {
          dataPoint[`model_${modelIdx}`] = point.probability;
        }
      });
      
      return dataPoint;
    });
  }, [priceHistory]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-zinc-500">
        No price history available
      </div>
    );
  }

  const modelIndices = Object.keys(priceHistory);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis 
          dataKey="displayTime" 
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={{ stroke: "#3f3f46" }}
        />
        <YAxis 
          domain={[0, 100]}
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={{ stroke: "#3f3f46" }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#16161f",
            border: "1px solid #2a2a3a",
            borderRadius: "8px",
            padding: "12px",
          }}
          labelStyle={{ color: "#a1a1aa", marginBottom: "8px" }}
          formatter={(value: number, name: string) => {
            const modelIdx = name.replace("model_", "");
            const model = models.find((m) => m.idx.toString() === modelIdx);
            return [`${value.toFixed(1)}%`, model?.fullName || `Model ${modelIdx}`];
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          formatter={(value: string) => {
            const modelIdx = value.replace("model_", "");
            const model = models.find((m) => m.idx.toString() === modelIdx);
            return <span className="text-xs text-zinc-400">{model?.fullName || `Model ${modelIdx}`}</span>;
          }}
        />
        {modelIndices.map((modelIdx, i) => {
          const model = models.find((m) => m.idx.toString() === modelIdx);
          return (
            <Line
              key={modelIdx}
              type="monotone"
              dataKey={`model_${modelIdx}`}
              name={`model_${modelIdx}`}
              stroke={model?.color || MODEL_COLORS[i % MODEL_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
