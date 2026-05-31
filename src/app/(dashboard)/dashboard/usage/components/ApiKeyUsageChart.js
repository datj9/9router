"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Card from "@/shared/components/Card";

const SERIES_COLORS = [
  "#6366f1", "#f59e0b", "#22c55e", "#ec4899", "#06b6d4",
  "#a855f7", "#ef4444", "#84cc16", "#3b82f6", "#f97316",
];

const METRIC_OPTIONS = [
  { value: "requests", label: "Requests" },
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Cost" },
];

const DIMENSION_OPTIONS = [
  { value: "model", label: "By Model" },
  { value: "project", label: "By Project" },
];

const fmtTokens = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
};
const fmtCost = (value) => `$${(value || 0).toFixed(2)}`;
const fmtRequests = (value) => new Intl.NumberFormat().format(value || 0);

function metricValue(entry, metric) {
  if (metric === "tokens") return (entry.promptTokens || 0) + (entry.completionTokens || 0);
  if (metric === "cost") return entry.cost || 0;
  return entry.requests || 0;
}

function formatMetric(value, metric) {
  if (metric === "tokens") return fmtTokens(value);
  if (metric === "cost") return fmtCost(value);
  return fmtRequests(value);
}

/**
 * Per-API-key usage as a stacked bar chart: one bar per API key, stacked by
 * either model or project (dimension toggle), with a Requests/Tokens/Cost
 * metric toggle.
 *
 * - "By Model" stacks consume byApiKey (keyed apiKey|model|provider).
 * - "By Project" stacks consume byApiKeyProject (keyed apiKey|project).
 * Both maps come from /api/usage/stats — no extra fetch.
 */
export default function ApiKeyUsageChart({ byApiKey, byApiKeyProject }) {
  const [metric, setMetric] = useState("requests");
  const [dimension, setDimension] = useState("model");

  const { chartData, series } = useMemo(() => {
    const source = dimension === "project" ? byApiKeyProject : byApiKey;
    const entries = Object.values(source || {});
    const seriesSet = new Set();
    const keyRows = {};

    for (const entry of entries) {
      const keyName = entry.keyName || "Local (No API Key)";
      const segment = dimension === "project"
        ? (entry.projectName || "Untagged")
        : (entry.rawModel || "Unknown");
      seriesSet.add(segment);

      if (!keyRows[keyName]) keyRows[keyName] = { apiKey: keyName };
      keyRows[keyName][segment] = (keyRows[keyName][segment] || 0) + metricValue(entry, metric);
    }

    const orderedSeries = [...seriesSet].sort((first, second) => first.localeCompare(second));
    const rows = Object.values(keyRows).sort((first, second) => {
      const firstTotal = orderedSeries.reduce((sum, key) => sum + (first[key] || 0), 0);
      const secondTotal = orderedSeries.reduce((sum, key) => sum + (second[key] || 0), 0);
      return secondTotal - firstTotal;
    });

    return { chartData: rows, series: orderedSeries };
  }, [byApiKey, byApiKeyProject, dimension, metric]);

  const hasData = chartData.length > 0 && series.length > 0;

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-text-main">API key usage</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:flex">
            {DIMENSION_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDimension(option.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${dimension === option.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:flex">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setMetric(option.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${metric === option.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-muted">
          No API key usage recorded yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 48)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatMetric(value, metric)}
            />
            <YAxis
              type="category"
              dataKey="apiKey"
              tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) => [formatMetric(value, metric), name]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {series.map((segment, index) => (
              <Bar
                key={segment}
                dataKey={segment}
                stackId="apiKey"
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                radius={index === series.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

ApiKeyUsageChart.propTypes = {
  byApiKey: PropTypes.object,
  byApiKeyProject: PropTypes.object,
};
