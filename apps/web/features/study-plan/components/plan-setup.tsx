"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { ProgrammeSummary, ProgrammeType } from "@/types/programme";
import { useProgramme } from "../api/queries";
import { intakeOf, masterIntakeFor } from "../lib/build-plan";
import { isOpenEntrance } from "../lib/open-entrance";
import type { PlanSetup as Setup } from "../lib/plan-storage";
import { intakeLabel } from "../lib/slots";
import { trackLabel, trackNamesIn } from "../lib/tracks";
import { SearchSelect, type SelectOption } from "./search-select";

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

/** Tracks as options: the Swedish heading is the value a plan saves, the English name the label. */
const trackOptions = (
  values: string[],
  names: Readonly<Record<string, string>>,
): SelectOption[] =>
  values.map((v) => ({ value: v, label: trackLabel(v, names) }));

type Props = {
  programmes: ProgrammeSummary[];
  initial: Setup | null;
  onSave: (setup: Setup) => void;
  onCancel?: () => void;
};

/**
 * What are you studying, since when, and towards which master's.
 *
 * Every KTH programme the ingest found is listed, grouped by degree type, and
 * found by typing its code or name. A civilingenjör student picks a master's
 * from the ones their own intake's syllabus maps, with the rest offered as open
 * competition; a bachelor's student may pick one as their next step, to see its
 * entry requirements. An open entrance (Öppen ingång) student also picks the
 * programme they continue in from year 2.
 */
export function PlanSetup({ programmes, initial, onSave, onCancel }: Props) {
  const [programme, setProgramme] = useState(initial?.programme ?? "");
  const [intake, setIntake] = useState(initial?.intake ?? "");
  const [continuation, setContinuation] = useState(initial?.continuation ?? "");
  const [track, setTrack] = useState(initial?.track ?? "");
  const [master, setMaster] = useState(initial?.master ?? "");
  const [masterTrack, setMasterTrack] = useState(initial?.masterTrack ?? "");
  const [summer, setSummer] = useState(initial?.summer ?? false);

  const summary = programmes.find((p) => p.code === programme) ?? null;
  const detail = useProgramme(programme || null).data ?? null;
  const openEntrance = isOpenEntrance(detail, intake || null);
  const nextDetail =
    useProgramme(openEntrance && continuation ? continuation : null).data ??
    null;
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
    return [...by.entries()].map(([type, list]) => ({
      heading: TYPE_LABEL[type],
      options: list.map((p) => ({
        value: p.code,
        code: p.code,
        label: p.nameEn,
        hint: p.lastAdmissionTerm
          ? `No intake after ${intakeLabel(p.lastAdmissionTerm)}`
          : undefined,
      })),
    }));
  }, [programmes]);

  // For an open entrance, tracks and master's mappings are the chosen programme's.
  const intakeData = intakeOf(
    openEntrance && nextDetail ? nextDetail : detail,
    intake || null,
  );
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
  const nextProgrammes = programmes.filter(
    (p) => p.type === "CING" && p.code !== programme,
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
      continuation: openEntrance ? continuation || null : null,
    });
  };

  const masterNote = (p: ProgrammeSummary) =>
    p.replacedBy.length
      ? `Last intake ${intakeLabel(p.lastAdmissionTerm ?? "")}, replaced by ${p.replacedBy.join(" and ")}`
      : p.firstAdmissionTerm &&
          masterIntake &&
          p.firstAdmissionTerm > masterIntake
        ? "Opens later"
        : undefined;
  const masterOption = (m: ProgrammeSummary): SelectOption => ({
    value: m.code,
    code: m.code,
    label: m.nameEn,
    hint: masterNote(m),
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sp-programme"
          className="font-medium text-[13px] text-cc-ink"
        >
          What are you studying?
        </label>
        <SearchSelect
          id="sp-programme"
          value={programme}
          onChange={(v) => {
            setProgramme(v);
            setIntake("");
            setContinuation("");
            setTrack("");
            setMaster("");
            setMasterTrack("");
          }}
          groups={groups}
          placeholder="Choose your programme"
          searchable
          searchPlaceholder="Search by code or name, e.g. CDATE or computer"
        />
      </div>

      {summary ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-intake"
            className="font-medium text-[13px] text-cc-ink"
          >
            When did you start?
          </label>
          <SearchSelect
            id="sp-intake"
            value={intake}
            onChange={setIntake}
            groups={[
              {
                options: summary.intakes.map((t) => ({
                  value: t,
                  label: intakeLabel(t),
                })),
              },
            ]}
            placeholder="Choose your intake"
          />
          <p className="text-[12px] text-cc-muted">
            Your intake decides which syllabus applies: its mandatory courses,
            and the master's programmes it maps.
          </p>
        </div>
      ) : null}

      {intake && openEntrance ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-continuation"
            className="font-medium text-[13px] text-cc-ink"
          >
            Which programme from year 2?
          </label>
          <SearchSelect
            id="sp-continuation"
            value={continuation}
            onChange={(v) => {
              setContinuation(v);
              setTrack("");
              setMaster("");
              setMasterTrack("");
            }}
            groups={[
              {
                options: nextProgrammes.map((p) => ({
                  value: p.code,
                  code: p.code,
                  label: p.nameEn,
                })),
              },
            ]}
            placeholder="Choose a programme"
            noneLabel="Not chosen yet"
            searchable
          />
          <p className="text-[12px] text-cc-muted">
            {summary?.code} covers year 1. Pick the programme you applied for,
            or got into, and its syllabus fills years 2–5.
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
          <SearchSelect
            id="sp-track"
            value={track}
            onChange={setTrack}
            groups={[
              {
                options: trackOptions(
                  programmeTracks,
                  trackNamesIn(detail, nextDetail),
                ),
              },
            ]}
            placeholder="Not chosen yet"
            noneLabel="Not chosen yet"
          />
        </div>
      ) : null}

      {intake && canPickMaster && (!openEntrance || continuation) ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sp-master"
            className="font-medium text-[13px] text-cc-ink"
          >
            {isCiving
              ? "Which master's do you want?"
              : "A master's after your degree? (optional)"}
          </label>
          <SearchSelect
            id="sp-master"
            value={master}
            onChange={(v) => {
              setMaster(v);
              setMasterTrack("");
            }}
            groups={[
              ...(isCiving && mapped.size
                ? [
                    {
                      heading: `Guaranteed place for ${openEntrance ? continuation : summary.code} ${intakeLabel(intake)}`,
                      options: masters
                        .filter((m) => mapped.has(m.code))
                        .map(masterOption),
                    },
                  ]
                : []),
              {
                heading: isCiving
                  ? "Open competition, no guaranteed place"
                  : "KTH master's programmes",
                options: masters
                  .filter((m) => !mapped.has(m.code))
                  .map(masterOption),
              },
            ]}
            placeholder="Not chosen yet"
            noneLabel="Not chosen yet"
            searchable
          />
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
          <SearchSelect
            id="sp-mtrack"
            value={masterTrack}
            onChange={setMasterTrack}
            groups={[
              {
                options: trackOptions(masterTracks, trackNamesIn(masterDetail)),
              },
            ]}
            placeholder="Not chosen yet"
            noneLabel="Not chosen yet"
          />
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
            className="h-10 cursor-pointer rounded-full px-4 text-[13.5px] text-cc-ink hover:bg-cc-pill"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!programme || !intake}
          className="h-10 cursor-pointer rounded-full bg-cc-btn px-5 font-medium text-[13.5px] text-cc-btn-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {initial ? "Save" : "Build my plan"}
        </button>
      </div>
    </form>
  );
}
