"use client";

import type {
  CourseCardChartData,
  ExaminationMethods,
  TheoreticalVsApplied,
} from "@/data/courseCardMockData";

/** Stacked bar: yellow = home assignments, blue = on-campus exam, green = laboratory moments (100% total). */
function ExaminationMethodsBar({ data }: { data: ExaminationMethods }) {
  const { homeAssignments, onCampusExam, laboratoryMoments } = data;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">
        Examination Methods
      </p>
      <div className="flex h-3.5 w-full overflow-hidden rounded bg-muted">
        <div
          className="bg-yellow-500 transition-all"
          style={{ width: `${homeAssignments}%` }}
          title={`Home assignments ${homeAssignments}%`}
        />
        <div
          className="bg-blue-600 transition-all"
          style={{ width: `${onCampusExam}%` }}
          title={`On-campus exam ${onCampusExam}%`}
        />
        <div
          className="bg-green-600 transition-all"
          style={{ width: `${laboratoryMoments}%` }}
          title={`Laboratory moments ${laboratoryMoments}%`}
        />
      </div>
    </div>
  );
}

/** Stacked bar: blue = theoretical, orange = applied (100% total). */
function TheoreticalVsAppliedBar({ data }: { data: TheoreticalVsApplied }) {
  const { theoretical, applied } = data;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">
        Theoretical vs Applied
      </p>
      <div className="flex h-3.5 w-full overflow-hidden rounded bg-muted">
        <div
          className="bg-sky-400 transition-all"
          style={{ width: `${theoretical}%` }}
          title={`Theoretical ${theoretical}%`}
        />
        <div
          className="bg-orange-500 transition-all"
          style={{ width: `${applied}%` }}
          title={`Applied ${applied}%`}
        />
      </div>
    </div>
  );
}

/** Gauge 1–10: calm grey fill (muted), track stays light grey. */
function GaugeBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex h-2 w-full overflow-hidden rounded-sm bg-muted">
        <div
          className="bg-muted-foreground/80 transition-all dark:bg-muted-foreground/70"
          style={{ width: `${pct}%` }}
          title={`${value}/10`}
        />
      </div>
    </div>
  );
}

export function CourseCardCharts({ data }: { data: CourseCardChartData }) {
  return (
    <div className="flex w-full min-w-[120px] max-w-full flex-col gap-3">
      <ExaminationMethodsBar data={data.examinationMethods} />
      <TheoreticalVsAppliedBar data={data.theoreticalVsApplied} />
      <GaugeBar value={data.workload} label="Workload" />
      <GaugeBar value={data.learningExperience} label="Learning Experience" />
    </div>
  );
}
