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

// Distinct, theme-agnostic palette for stacking models within a project bar.
// Reused cyclically when a project has more models than colors.
const MODEL_COLORS = [
  "#6366f1", "#f59e0b", "#22c55e", "#ec4899", "#06b6d4",
  "#a855f7", "#ef4444", "#84cc16", "#3b82f6", "#f97316",
];

const METRIC_OPTIONS = [
  { value: "requests", label: "Requests" },
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Cost" },
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
 * Stacked bar chart: one bar per project, segmented by model. The metric toggle
 * switches the stacked value between request count, total tokens, and cost so a
 * single chart answers both "which model is used most per project" and
 * "model cost per project".
 *
 * Consumes the byProject map from /api/usage/stats (keyed project|model|provider,
 * each value carrying projectName, rawModel, requests, promptTokens,
 * completionTokens, cost) — no extra fetch required.
 */
export default function ProjectModelChart({ byProject }) {
  const [metric, setMetric] = useState("requests");

  const { chartData, models } = useMemo(() => {
    const entries = Object.values(byProject || {});
    const modelSet = new Set();
    const projectRows = {};
    const projectEntries = {};

    for (const entry of entries) {
      const projectName = entry.projectName || "Untagged";
      const model = entry.rawModel || "Unknown";
      modelSet.add(model);

      if (!projectRows[projectName]) projectRows[projectName] = { project: projectName };
      projectRows[projectName][model] = (projectRows[projectName][model] || 0) + metricValue(entry, metric);
      projectEntries[projectName] ??= [];
      projectEntries[projectName].push(entry);
    }

    const orderedModels = [...modelSet].sort((first, second) => first.localeCompare(second));

    // Drop projects that are zero on any of requests / tokens / cost —
    // typical for tokens-without-pricing rows that show as 0-cost bars.
    const nonEmptyProjects = Object.entries(projectRows).filter(([projectName]) => {
      const rows = projectEntries[projectName] || [];
      const totalRequests = rows.reduce((sum, e) => sum + (e.requests || 0), 0);
      const totalTokens = rows.reduce(
        (sum, e) => sum + (e.promptTokens || 0) + (e.completionTokens || 0),
        0,
      );
      const totalCost = rows.reduce((sum, e) => sum + (e.cost || 0), 0);
      return totalRequests > 0 && totalTokens > 0 && totalCost > 0;
    });

    // Sort projects by their total for the active metric, busiest first.
    const rows = nonEmptyProjects
      .map(([projectName, row]) => row)
      .sort((first, second) => {
        const firstTotal = orderedModels.reduce((sum, model) => sum + (first[model] || 0), 0);
        const secondTotal = orderedModels.reduce((sum, model) => sum + (second[model] || 0), 0);
        return secondTotal - firstTotal;
      });

    return { chartData: rows, models: orderedModels };
  }, [byProject, metric]);

  const hasData = chartData.length > 0 && models.length > 0;

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-text-main">Model usage by project</h3>
        <div className="grid grid-cols-3 items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:flex sm:w-auto">
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

      {!hasData ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-muted">
          No project usage recorded yet. Send the x-project header to tag requests.
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
              dataKey="project"
              tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
              tickLine={false}
              axisLine={false}
              width={110}
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
            {models.map((model, index) => (
              <Bar
                key={model}
                dataKey={model}
                stackId="project"
                fill={MODEL_COLORS[index % MODEL_COLORS.length]}
                radius={index === models.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

ProjectModelChart.propTypes = {
  byProject: PropTypes.object,
};
