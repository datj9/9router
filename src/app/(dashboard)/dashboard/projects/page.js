"use client";

import { Suspense } from "react";
import { UsageStats, CardSkeleton } from "@/shared/components";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-text-muted">
            Per-project usage. Tag requests with the <code className="font-mono">x-project</code> header
            to break down token and cost by project and model.
          </p>
        </div>
        <UsageStats defaultTableView="project" lockTableView />
      </div>
    </Suspense>
  );
}
