"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Filter = "all" | "open" | "dueSoon" | "waiting" | "pending" | "assigned" | "completed";
type Status = "open" | "in_progress" | "waiting" | "completed" | "cancelled" | "doing" | "done" | "stopped";
type Task = {
  id: string;
  title: string;
  status: Status;
  due_at: string | null;
  notes: string | null;
  priority?: string | null;
  waiting_on?: string | null;
  follow_up_date?: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "dueSoon", label: "Due soon" },
  { key: "waiting", label: "Waiting" },
  { key: "pending", label: "Pending" },
  { key: "assigned", label: "Assigned out" },
  { key: "completed", label: "Completed" },
];

function normalize(status: string) {
  if (status === "doing") return "in_progress";
  if (status === "done") return "completed";
  if (status === "stopped") return "cancelled";
  return status;
}
function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function dueParts(value: string | null) {
  if (!value) return { dueDate: "", dueTime: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dueDate: "", dueTime: "" };
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { dueDate: local.slice(0, 10), dueTime: local.slice(11, 16) };
}

export function TasksDesk({
  workspaceId,
  initialTasks,
  members,
}: {
  workspaceId: string;
  currentUserId?: string;
  initialTasks: Task[];
  members: { user_id: string; role: string }[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [userId, setUserId] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState(initialTasks[0]?.id || "");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState<Status>("open");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = tasks.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    void createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      const id = data.user?.id || "";
      setUserId(id);
      if (!assignee) setAssignee(id);
    });
  }, []);

  useEffect(() => {
    if (creating || !selected) return;
    const due = dueParts(selected.due_at);
    setTitle(selected.title);
    setDescription(selected.notes || "");
    setPriority(selected.priority || "normal");
    setStatus(normalize(selected.status) as Status);
    setDueDate(due.dueDate);
    setDueTime(due.dueTime);
    setWaitingOn(selected.waiting_on || "");
    setFollowUpDate(selected.follow_up_date || "");
    setAssignee(selected.assigned_to || selected.owner_id || userId);
  }, [selectedId, creating]);

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  function inFilter(task: Task, key: Filter) {
    const statusValue = normalize(task.status);
    const due = task.due_at ? task.due_at.slice(0, 10) : "";
    if (key === "all") return true;
    if (key === "open") return ["open", "in_progress"].includes(statusValue);
    if (key === "dueSoon") return !["completed", "cancelled"].includes(statusValue) && Boolean(due && due >= today && due <= soon);
    if (key === "waiting") return statusValue === "waiting";
    if (key === "pending") return Boolean(task.assigned_to && task.assigned_to !== userId && ["open", "in_progress"].includes(statusValue));
    if (key === "assigned") return Boolean(task.assigned_to && task.assigned_to !== (task.owner_id || userId));
    return statusValue === "completed";
  }

  const counts = {
    all: tasks.length,
    open: tasks.filter((task) => inFilter(task, "open")).length,
    dueSoon: tasks.filter((task) => inFilter(task, "dueSoon")).length,
    waiting: tasks.filter((task) => inFilter(task, "waiting")).length,
    pending: tasks.filter((task) => inFilter(task, "pending")).length,
    assigned: tasks.filter((task) => inFilter(task, "assigned")).length,
    completed: tasks.filter((task) => inFilter(task, "completed")).length,
  };
  const filtered = useMemo(() => tasks.filter((task) => inFilter(task, filter)), [tasks, filter, userId]);

  function startNew() {
    setCreating(true);
    setSelectedId("");
    setFilter("open");
    setTitle("");
    setDescription("");
    setPriority("normal");
    setStatus("open");
    setDueDate("");
    setDueTime("");
    setWaitingOn("");
    setFollowUpDate("");
    setAssignee(userId);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueDate || !dueTime || saving) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const dueAt = new Date(`${dueDate}T${dueTime}:00`).toISOString();
    const row = {
      workspace_id: workspaceId,
      title: title.trim(),
      notes: description,
      status,
      priority,
      due_at: dueAt,
      waiting_on: waitingOn || null,
      follow_up_date: followUpDate || null,
      assigned_to: assignee || userId,
      owner_id: userId || null,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const result = creating || !selectedId
      ? await supabase.from("tasks").insert(row).select("id, title, status, due_at, notes, priority, waiting_on, follow_up_date, completed_at, assigned_to, owner_id, created_at, updated_at").single()
      : await supabase.from("tasks").update(row).eq("id", selectedId).select("id, title, status, due_at, notes, priority, waiting_on, follow_up_date, completed_at, assigned_to, owner_id, created_at, updated_at").single();
    setSaving(false);
    if (result.error || !result.data) {
      setMessage(result.error?.message || "Run the tasks SQL if a column is missing.");
      return;
    }
    setTasks((current) => creating || !selectedId ? [result.data, ...current] : current.map((item) => (item.id === result.data.id ? result.data : item)));
    setCreating(false);
    setSelectedId(result.data.id);
    setMessage(creating ? "Task created." : "Task updated.");
  }

  async function setTaskStatus(next: Status) {
    if (!selected) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("tasks").update({ status: next, completed_at: next === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", selected.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setTasks((current) => current.map((item) => (item.id === selected.id ? { ...item, status: next } : item)));
    setStatus(next);
    setMessage(next === "completed" ? "Task completed." : "Task reopened.");
  }

  return (
    <div className="contacts-desk">
      <div className="contacts-top">
        <div>
          <h2>
            Tasks <span className="badge">Executive control</span>
          </h2>
          <p className="meta">Assign work to other users in this account. Assigned tasks appear immediately on their task list.</p>
        </div>
        <button type="button" onClick={startNew} style={{ background: "#17243f", color: "#fff", border: 0 }}>
          New task
        </button>
      </div>
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {FILTERS.map((item) => (
          <button key={item.key} type="button" className={filter === item.key ? "kpi kpi-dark" : "kpi"} onClick={() => setFilter(item.key)}>
            <strong>{counts[item.key]}</strong>
            <span className="kicker">{item.label}</span>
          </button>
        ))}
      </div>
      {message ? <p className="meta">{message}</p> : null}
      <div className="contacts-split">
        <aside className="contacts-list">
          <p className="meta">Showing {filtered.length}</p>
          {filtered.map((task) => (
            <button key={task.id} type="button" className={task.id === selectedId && !creating ? "contact-row selected" : "contact-row"} onClick={() => { setCreating(false); setSelectedId(task.id); }}>
              <strong>{task.title}</strong>
              <span>{pretty(normalize(task.status))}</span>
              <small>{task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}</small>
            </button>
          ))}
          {!filtered.length ? <p className="meta">No tasks in this filter.</p> : null}
        </aside>
        <form className="contact-record card stack" onSubmit={save}>
          <p className="kicker">{creating ? "New task" : "Task record"}</p>
          <h3>{creating ? "Create task" : title || "Select a task"}</h3>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting">Waiting</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>
              Assign to
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value={userId}>Me</option>
                {members.filter((member) => member.user_id !== userId).map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.role} · {member.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
            <label>Due time<input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required /></label>
            <label>Waiting on<input value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} /></label>
            <label>Follow up date<input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></label>
          </div>
          <label>Description<textarea className="field" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="row">
            <button type="submit" disabled={saving} style={{ background: "#17243f", color: "#fff", border: 0 }}>
              {saving ? "Saving..." : creating ? "Create task" : "Save task"}
            </button>
            {selected && !creating ? (
              normalize(selected.status) === "completed" ? (
                <button type="button" className="chip" onClick={() => void setTaskStatus("open")}>Reopen</button>
              ) : (
                <button type="button" className="chip" onClick={() => void setTaskStatus("completed")}>Complete</button>
              )
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
