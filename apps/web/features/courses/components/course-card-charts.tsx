import { Progress } from "@/components/ui/progress";
import type {
  CourseCardChartData,
  ExaminationMethods,
  TheoreticalVsApplied,
} from "@/data/courseCardMockData";

function ExaminationMethodsBar({ data }: { data: ExaminationMethods }) {
  const { homeAssignments, onCampusExam, laboratoryMoments } = data;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">
        Examination Methods
      </p>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-chart-1 transition-all"
          style={{ width: `${homeAssignments}%` }}
          title={`Home assignments ${homeAssignments}%`}
        />
        <div
          className="bg-chart-2 transition-all"
          style={{ width: `${onCampusExam}%` }}
          title={`On-campus exam ${onCampusExam}%`}
        />
        <div
          className="bg-chart-3 transition-all"
          style={{ width: `${laboratoryMoments}%` }}
          title={`Laboratory moments ${laboratoryMoments}%`}
        />
      </div>
    </div>
  );
}

function TheoreticalVsAppliedBar({ data }: { data: TheoreticalVsApplied }) {
  const { theoretical, applied } = data;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">
        Theoretical vs Applied
      </p>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-chart-2 transition-all"
          style={{ width: `${theoretical}%` }}
          title={`Theoretical ${theoretical}%`}
        />
        <div
          className="bg-chart-4 transition-all"
          style={{ width: `${applied}%` }}
          title={`Applied ${applied}%`}
        />
      </div>
    </div>
  );
}

function GaugeBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Progress value={pct} title={`${value}/10`} />
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
