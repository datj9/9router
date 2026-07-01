import { describe, expect, it } from "vitest";
import { sortData, groupDataByKey } from "@/shared/components/UsageStats.js";

const byProject = {
  "A|m1": { projectName: "ProjA", promptTokens: 5000, completionTokens: 5000, cost: 1.0 },
  "A|m2": { projectName: "ProjA", promptTokens: 5000, completionTokens: 5000, cost: 1.0 },
  "A|m3": { projectName: "ProjA", promptTokens: 5000, completionTokens: 5000, cost: 1.0 },
  "B|m1": { projectName: "ProjB", promptTokens: 12000, completionTokens: 12000, cost: 0.1 },
};

function order(sortBy, sortOrder) {
  return groupDataByKey(sortData(byProject, {}, sortBy, sortOrder), "projectName", sortBy, sortOrder)
    .map((group) => group.groupKey);
}

describe("usage group sort", () => {
  it("orders groups by totalTokens desc using the group aggregate", () => {
    // ProjA=30000 > ProjB=24000 despite ProjB's single row being largest
    expect(order("totalTokens", "desc")).toEqual(["ProjA", "ProjB"]);
  });

  it("orders groups by totalCost desc", () => {
    // ProjA=3.00 > ProjB=0.10
    expect(order("totalCost", "desc")).toEqual(["ProjA", "ProjB"]);
  });

  it("orders groups by label ascending", () => {
    expect(order("projectName", "asc")).toEqual(["ProjA", "ProjB"]);
  });

  it("sums totalCost into the group summary", () => {
    const groups = groupDataByKey(sortData(byProject, {}, "totalCost", "desc"), "projectName", "totalCost", "desc");
    expect(groups[0].summary.totalCost).toBeCloseTo(3.0);
  });

  it("returns empty array for empty input", () => {
    expect(groupDataByKey(sortData({}, {}, "totalTokens", "desc"), "projectName", "totalTokens", "desc")).toEqual([]);
  });
});
