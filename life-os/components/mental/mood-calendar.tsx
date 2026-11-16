import Link from "next/link";
import { addDays, startOfWeek } from "@/lib/dates";
import { formatDay } from "@/lib/format";
import type { DayPoint } from "@/lib/mental/stats";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Un solo tono: más intenso = valor más alto. No es "bueno" ni "malo", solo el número que registraste. */
export function shade(v: number) {
  const pct = Math.round(15 + ((v - 1) / 9) * 85);
  return `color-mix(in srgb, var(--series-1) ${pct}%, var(--card))`;
}

/** Calendario de ánimo: columnas por semana, filas por día de la semana. */
export function MoodCalendar({ points, from, to, weekStartsOn }: { points: DayPoint[]; from: string; to: string; weekStartsOn: number }) {
  const mood = new Map(points.filter((p) => p.mood != null).map((p) => [p.date, p.mood as number]));
  const first = startOfWeek(from, weekStartsOn);
  const weeks: string[][] = [];
  for (let w = first; w <= to; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  const labels = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStartsOn + i) % 7]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1">
          <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-5 text-muted" aria-hidden>
            {labels.map((l, i) => <span key={i} className="h-5">{i % 2 === 0 ? l : ""}</span>)}
          </div>
          {weeks.map((days) => (
            <div key={days[0]} className="grid grid-rows-7 gap-1">
              {days.map((d) => {
                const inRange = d >= from && d <= to;
                const v = mood.get(d);
                if (!inRange) return <span key={d} className="size-5" aria-hidden />;
                const label = `${formatDay(d, "EEEE, MMM d")}: ${v == null ? "no entry" : `mood ${v}/10`}`;
                return (
                  <Link
                    key={d}
                    href={`/calendar?view=day&date=${d}`}
                    title={label}
                    aria-label={label}
                    className="size-5 rounded-[3px] outline-offset-1 hover:outline hover:outline-2 hover:outline-foreground"
                    style={v == null ? { border: "1px dashed var(--border)" } : { background: shade(v) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          1
          {[1, 3, 5, 7, 10].map((v) => <span key={v} className="size-3 rounded-[2px]" style={{ background: shade(v) }} aria-hidden />)}
          10
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-[2px] border border-dashed border-border" aria-hidden /> No entry
        </span>
        <span>{mood.size} {mood.size === 1 ? "day logged" : "days logged"}</span>
      </div>
    </div>
  );
}
