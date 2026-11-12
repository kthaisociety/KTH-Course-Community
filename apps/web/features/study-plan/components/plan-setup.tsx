"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { ProgrammeSummary, ProgrammeType } from "@/types/programme";
import { useProgramme } from "../api/queries";
import { intakeOf, masterIntakeFor } from "../lib/build-plan";
import type { PlanSetup as Setup } from "../lib/plan-storage";
import { intakeLabel } from "../lib/slots";

const TYPE_LABEL: Record<ProgrammeType, string> = {
  CING: "Civilingenjör · 300 hp · 5 years",
  TARKU: "Arkitekt · 300 hp · 5 years",
  YHOGE: "Högskoleingenjör · 180 hp · 3 years",
  GKAND: "Kandidat · 180 hp · 3 years",
  TMAST: "Master's · 120 hp · 2 years",
  GMAGB: "Magister · 60 hp · 1 year",
  TBAS: "Tekniskt basår",
  OTHER: "Other",
};

export const fieldClass =
  "h-10 w-full rounded-[10px] border border-cc-rule2 bg-cc-surface px-3 text-[13.5px] text-cc-ink outline-none focus-visible:ring-[3px] focus-visible:ring-cc-focus/30";

function tracksOf(rows: { track: string | null }[] | undefined) {
  return [
    ...new Set(
      (rows ?? []).map((r) => r.track).filter((t): t is string => !!t),
    ),
  ].sort((a, b) => a.localeCompare(b, "sv"));
}

type Props = {
  programmes: ProgrammeSummary[];
  initial: Setup | null;
  onSave: (setup: Setup) => void;
  onCancel?: () => void;
};

/**
 * What are you studying, since when, and towards which master's.
 *
 * Every KTH programme the ingest found is listed, grouped by degree type. A
 * civilingenjör student picks a master's from the ones their own intake's
 * syllabus maps, with the rest offered as open competition; a bachelor's
 * student may pick one as their next step, to see its entry requirements.
 */
export function PlanSetup({ programmes, initial, onSave, onCancel }: Props) {
  const [programme, setProgramme] = useState(initial?.programme ?? "");
  const [intake, setIntake] = useState(initial?.intake ?? "");
  const [track, setTrack] = useState(initial?.track ?? "");
  const [master, setMaster] = useState(initial?.master ?? "");
  const [masterTrack, setMasterTrack] = useState(initial?.masterTrack ?? "");
  const [summer, setSummer] = useState(initial?.summer ?? false);

  const summary = programmes.find((p) => p.code === programme) ?? null;
  const detail = useProgramme(programme || null).data ?? null;
  const masterDetail = useProgramme(master || null).data ?? null;
  const isCiving = summary?.type === "CING";
  const canPickMaster =
    summary &&
    summary.type !== "TMAST" &&
    summary.type !== "TBAS" &&
    summary.type !== "GMAGB";

  const groups = useMemo(() => {
    const by = new Map<ProgrammeType, ProgrammeSummary[]>();
    for (const p of programmes) by.set(p.type, [...(by.get(p.type) ?? []), p]);
    return [...by.entries()];
  }, [programmes]);

  const intakeData = intakeOf(detail, intake || null);
  const programmeTracks = tracksOf(
    Object.entries(intakeData?.years ?? {})
      .filter(([y]) => !isCiving || Number(y) <= 3)
      .flatMap(([, rows]) => rows),
  );
  const masters = programmes.filter((p) => p.type === "TMAST");
  const mapped = new Set(intakeData?.mastersMapped ?? []);
  const masterIntake = isCiving && intake ? masterIntakeFor(intake) : null;
  const masterTracks = tracksOf(
    Object.values(intakeOf(masterDetail, masterIntake)?.years ?? {}).flat(),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!programme || !intake) return;
    onSave({
      programme,
      intake,
      track: track || null,
      master: canPickMaster ? master || null : null,
      masterTrack: canPickMaster && master ? masterTrack || null : null,
      summer,
    });
  };

  const masterNote = (p: ProgrammeSummary) =>
    p.replacedBy.length
      ? ` — last intake ${intakeLabel(p.lastAdmissionTerm ?? "")}, replaced by ${p.replacedBy.join(" and ")}`
      : p.firstAdmissionTerm &&
          masterIntake &&
          p.firstAdmissionTerm > masterIntake
        ? " — opens later"
        : "";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sp-programme"
          className="font-medium text-[13px] text-cc-ink"
        >
          What are you studying?
        </label>
        <select
          id="sp-programme"
          value={programme}
          onChange={(e) => {
            setProgramme(e.target.value);
            setIntake("");
            setTrack("");
            setMaster("");
            setMasterTrack("");
          }}
          className={fieldClass}
          required
        >
          <option value="">Choose your programme</option>
          {groups.map(([type, list]) => (
            <optgroup key={type} label={TYPE_LABEL[type]}>
              {list.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.nameEn}
                  {p.lastAdmissionTerm
                    ? ` (no intake after ${intakeLabel(p.lastAdmissionTerm)})`
                    : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {summary ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-intake"
            className="font-medium text-[13px] text-cc-ink"
          >
            When did you start?
          </label>
          <select
            id="sp-intake"
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="">Choose your intake</option>
            {summary.intakes.map((t) => (
              <option key={t} value={t}>
                {intakeLabel(t)}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-cc-muted">
            Your intake decides which syllabus applies: its mandatory courses,
            and the master's programmes it maps.
          </p>
        </div>
      ) : null}

      {intake && programmeTracks.length ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-track"
            className="font-medium text-[13px] text-cc-ink"
          >
            Track
          </label>
          <select
            id="sp-track"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className={fieldClass}
          >
            <option value="">Not chosen yet</option>
            {programmeTracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {intake && canPickMaster ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-master"
            className="font-medium text-[13px] text-cc-ink"
          >
            {isCiving
              ? "Which master's do you want?"
              : "A master's after your degree? (optional)"}
          </label>
          <select
            id="sp-master"
            value={master}
            onChange={(e) => {
              setMaster(e.target.value);
              setMasterTrack("");
            }}
            className={fieldClass}
          >
            <option value="">Not chosen yet</option>
            {isCiving && mapped.size ? (
              <optgroup
                label={`Guaranteed place for ${summary.code} ${intakeLabel(intake)}`}
              >
                {masters
                  .filter((m) => mapped.has(m.code))
                  .map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} · {m.nameEn}
                      {masterNote(m)}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup
              label={
                isCiving
                  ? "Open competition, no guaranteed place"
                  : "KTH master's programmes"
              }
            >
              {masters
                .filter((m) => !mapped.has(m.code))
                .map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} · {m.nameEn}
                    {masterNote(m)}
                  </option>
                ))}
            </optgroup>
          </select>
          {isCiving ? (
            <p className="text-[12px] text-cc-muted">
              Its syllabus fills years 4–5, and its entry requirements are
              checked against years 1–3.
            </p>
          ) : null}
        </div>
      ) : null}

      {master && masterTracks.length && isCiving ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-mtrack"
            className="font-medium text-[13px] text-cc-ink"
          >
            Master's track
          </label>
          <select
            id="sp-mtrack"
            value={masterTrack}
            onChange={(e) => setMasterTrack(e.target.value)}
            className={fieldClass}
          >
            <option value="">Not chosen yet</option>
            {masterTracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-[13px] text-cc-ink">
        <input
          type="checkbox"
          checked={summer}
          onChange={(e) => setSummer(e.target.checked)}
          className="size-4 accent-cc-brand"
        />
        Show summer courses
      </label>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-[10px] px-4 text-[13.5px] text-cc-ink hover:bg-cc-pill"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!programme || !intake}
          className="h-10 cursor-pointer rounded-[10px] bg-cc-btn px-5 font-medium text-[13.5px] text-cc-btn-fg disabled:opacity-50"
        >
          {initial ? "Save" : "Build my plan"}
        </button>
      </div>
    </form>
  );
}
