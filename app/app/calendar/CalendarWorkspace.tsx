"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CalEvent = { id: string; title: string; starts_at: string; ends_at: string | null };
type Task = { id: string; title: string; status: string; due_at: string | null };
type Item = {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  kind: "appointment" | "task";
  source?: "google" | "workspace";
};

function keyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(first.getDate() - first.getDay());
  first.setHours(0, 0, 0, 0);
  return first;
}
function gridDays(month: Date) {
  const first = startOfGrid(month);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

export function CalendarWorkspace({
  workspaceId,
  events,
  tasks,
}: {
  workspaceId: string;
  events: CalEvent[];
  tasks: Task[];
}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [eventList, setEventList] = useState(events);
  const [googleItems, setGoogleItems] = useState<Item[]>([]);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => keyFromDate(new Date()));
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [message, setMessage] = useState("");

  const days = useMemo(() => gridDays(month), [month]);

  useEffect(() => {
    const rangeStart = days[0].toISOString();
    const rangeEnd = new Date(days[41]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    fetch(`/api/calendar/google?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd.toISOString())}`)
      .then((response) => response.json())
      .then((payload) => {
        setGoogleConnected(Boolean(payload.connected));
        setGoogleEmail(payload.email || "");
        setGoogleItems(payload.items || []);
        if (payload.error) setNotice(payload.error);
        else setNotice("");
      })
      .catch(() => setNotice("Could not reach Google Calendar."));
  }, [month.getFullYear(), month.getMonth()]);

  const items = useMemo<Item[]>(() => {
    const local = eventList.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.starts_at,
      end: event.ends_at,
      kind: "appointment" as const,
      source: "workspace" as const,
    }));
    const datedTasks = tasks
      .filter((task) => task.due_at)
      .map((task) => ({
        id: task.id,
        title: task.title,
        start: task.due_at as string,
        kind: "task" as const,
        source: "workspace" as const,
      }));
    return [...local, ...datedTasks, ...googleItems];
  }, [eventList, tasks, googleItems]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!item.start) continue;
      const key = keyFromDate(new Date(item.start));
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }, [items]);

  const todayKey = keyFromDate(new Date());
  const selectedItems = [...(byDay.get(selectedDay) || [])].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const appointments = items.filter((item) => item.kind === "appointment").length;
  const datedTasks = items.filter((item) => item.kind === "task").length;

  function showMonth(next: Date) {
    const normalized = new Date(next.getFullYear(), next.getMonth(), 1);
    setMonth(normalized);
    const today = new Date();
    setSelectedDay(
      normalized.getFullYear() === today.getFullYear() && normalized.getMonth() === today.getMonth()
        ? keyFromDate(today)
        : keyFromDate(normalized)
    );
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !title.trim() || !startsAt) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      })
      .select("id, title, starts_at, ends_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save event.");
      return;
    }
    setEventList((current) => [...current, data]);
    setTitle("");
    setStartsAt("");
    setEndsAt("");
    setMessage("");
    setSelectedDay(keyFromDate(new Date(data.starts_at)));
  }

  return (
    <section className="main calendar-page">
      <div className="calendar-header">
        <div>
          <p className="kicker">
            Calendar <span className="badge">Unified view</span>
          </p>
          <h2>Calendar</h2>
          <p className="meta">
            {googleConnected
              ? `Google Calendar connected${googleEmail ? ` as ${googleEmail}` : ""}.`
              : "Add Gmail to load Google Calendar onto this grid."}
          </p>
        </div>
        <button type="button" className="chip" onClick={() => showMonth(new Date())}>
          Today
        </button>
      </div>
      {notice ? <p className="meta">{notice}</p> : null}

      <div className="count-row">
        <div className="card">
          <p className="kicker">Appointments</p>
          <p className="count">{appointments}</p>
        </div>
        <div className="card">
          <p className="kicker">Dated tasks</p>
          <p className="count">{datedTasks}</p>
        </div>
        <div className="card">
          <p className="kicker">This day</p>
          <p className="count">{selectedItems.length}</p>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="month-card">
          <div className="month-nav">
            <button type="button" onClick={() => showMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              ‹
            </button>
            <h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
            <button type="button" onClick={() => showMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
          <div className="dow">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid-days">
            {days.map((day) => {
              const key = keyFromDate(day);
              const dayItems = byDay.get(key) || [];
              const outside = day.getMonth() !== month.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={`day ${key === selectedDay ? "selected" : ""} ${key === todayKey ? "today" : ""} ${outside ? "outside" : ""}`}
                  onClick={() => setSelectedDay(key)}
                >
                  <span>{day.getDate()}</span>
                  {dayItems.slice(0, 3).map((item) => (
                    <em key={item.id} className={item.kind}>
                      {item.title}
                    </em>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="day-rail">
          <div className="card">
            <p className="kicker">Selected day</p>
            <h3>{selectedDay}</h3>
            <ul className="record-list">
              {selectedItems.length === 0 ? <li>Nothing scheduled.</li> : null}
              {selectedItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="meta">
                      {item.source === "google" ? "Google" : item.kind} ·{" "}
                      {new Date(item.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <form className="stack" onSubmit={addEvent}>
            <p className="kicker">Add workspace appointment</p>
            <label>
              Event
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Starts
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>
            <label>
              Ends
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <button type="submit">Add event</button>
          </form>
          {message ? <p>{message}</p> : null}
        </aside>
      </div>
    </section>
  );
}
