"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Task = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  notes: string | null;
  created_at: string;
};

export function TaskList({
  workspaceId,
  initialTasks,
}: {
  workspaceId: string;
  initialTasks: Task[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !title.trim()) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        owner_id: user?.id ?? null,
        title: title.trim(),
        status: "open",
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      })
      .select("id, title, status, due_at, notes, created_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not create task.");
      return;
    }
    setTasks((current) => [data, ...current]);
    setTitle("");
    setDueAt("");
    setMessage("");
  }

  async function setStatus(id: string, status: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addTask}>
        <label>
          New task
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Call the client" />
        </label>
        <label>
          Due (optional)
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <button type="submit">Add task</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {tasks.length === 0 ? <li>No tasks yet.</li> : null}
        {tasks.map((task) => (
          <li key={task.id} className={task.status === "done" ? "done" : undefined}>
            <div>
              <strong>{task.title}</strong>
              <div className="meta">
                {task.status}
                {task.due_at ? ` · due ${new Date(task.due_at).toLocaleString()}` : ""}
              </div>
            </div>
            <div className="row">
              {task.status !== "done" ? (
                <button type="button" className="secondary" onClick={() => setStatus(task.id, "done")}>
                  Done
                </button>
              ) : (
                <button type="button" className="secondary" onClick={() => setStatus(task.id, "open")}>
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
