import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const WS = "ws://localhost:8000/ws";

type Task = {
  task: string;
  agent: string;
  status: string;
  result?: string;
  error?: string;
  started_at: string;
  completed_at?: string;
};

type ApprovalRequest = {
  id: string;
  task: string;
  agent: string;
  status: string;
  created_at: string;
};

type LogEntry = {
  type: string;
  message: string;
  timestamp: string;
  agent?: string;
};

export default function App() {
  const [task, setTask] = useState("");
  const [agent, setAgent] = useState("auto");
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [liveLog, setLiveLog] = useState<LogEntry[]>([]);
  const [memoryGraph, setMemoryGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [activeTab, setActiveTab] = useState<"tasks" | "approvals" | "memory" | "audit">("tasks");
  const [submitting, setSubmitting] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket(WS);
    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const entry: LogEntry = {
        type: msg.type,
        message: formatWSMessage(msg),
        timestamp: new Date().toISOString(),
        agent: msg.agent,
      };
      setLiveLog((prev) => [...prev.slice(-50), entry]);

      if (msg.type === "approval_required") {
        setPendingApprovals((prev) => [...prev, { id: msg.request_id, task: msg.task, agent: msg.agent, status: "pending", created_at: new Date().toISOString() }]);
      }
      if (msg.type === "task_completed" || msg.type === "task_started" || msg.type === "task_failed") {
        fetchTasks();
        fetchMemory();
      }
      if (msg.type === "approval_resolved") {
        fetchApprovals();
      }
    };
    ws.current.onerror = () => addLog("system", "WebSocket error - is backend running?");
    return () => ws.current?.close();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLog]);

  useEffect(() => {
    fetchTasks();
    fetchApprovals();
    fetchAudit();
    fetchMemory();
    const interval = setInterval(() => { fetchTasks(); fetchApprovals(); fetchAudit(); }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (type: string, message: string) => {
    setLiveLog((prev) => [...prev.slice(-50), { type, message, timestamp: new Date().toISOString() }]);
  };

  const formatWSMessage = (msg: any) => {
    switch (msg.type) {
      case "task_started": return `[${msg.agent?.toUpperCase()}] Starting: "${msg.task?.slice(0, 60)}..."`;
      case "task_completed": return `[${msg.agent?.toUpperCase()}] Completed task`;
      case "task_failed": return `[${msg.agent?.toUpperCase()}] Failed: ${msg.error}`;
      case "approval_required": return `[GOVERNANCE] Approval required for: "${msg.task?.slice(0, 50)}..."`;
      case "approval_resolved": return `[GOVERNANCE] Request ${msg.request_id} ${msg.approved ? "APPROVED" : "REJECTED"}`;
      default: return JSON.stringify(msg);
    }
  };

  const fetchTasks = async () => {
    const res = await axios.get(`${API}/tasks`);
    setActiveTasks(res.data.active);
    setCompletedTasks(res.data.completed.reverse());
  };

  const fetchApprovals = async () => {
    const res = await axios.get(`${API}/approvals/pending`);
    setPendingApprovals(res.data);
  };

  const fetchAudit = async () => {
    const res = await axios.get(`${API}/audit`);
    setAuditLog(res.data.reverse());
  };

  const fetchMemory = async () => {
    const res = await axios.get(`${API}/memory`);
    setMemoryGraph(res.data);
  };

  const submitTask = async () => {
    if (!task.trim()) return;
    setSubmitting(true);
    addLog("submit", `Submitting: "${task}"`);
    try {
      await axios.post(`${API}/task`, { task, agent: agent === "auto" ? null : agent });
      setTask("");
    } catch (e) {
      addLog("error", "Failed to submit task");
    }
    setSubmitting(false);
  };

  const resolveApproval = async (id: string, approved: boolean) => {
    await axios.post(`${API}/approvals/${id}`, { approved, reason: approved ? "Approved via dashboard" : "Rejected via dashboard" });
    fetchApprovals();
    fetchAudit();
  };

  const agentColor = (name: string) => {
    const colors: Record<string, string> = { coder: "#00ff88", researcher: "#00aaff", planner: "#ff9900", system: "#ff4444" };
    return colors[name] || "#888";
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-900 text-green-300",
      running: "bg-blue-900 text-blue-300",
      failed: "bg-red-900 text-red-300",
      pending_approval: "bg-yellow-900 text-yellow-300",
    };
    return styles[status] || "bg-gray-800 text-gray-400";
  };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#0a0a0f", minHeight: "100vh", color: "#e0e0e0" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a2e", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 8px #00ff88", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#fff" }}>NOMOS ORCHESTRATOR</span>
          <span style={{ fontSize: 11, color: "#444", letterSpacing: 1 }}>v1.0.0</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#555" }}>
          <span>AGENTS: <span style={{ color: "#00ff88" }}>3 ONLINE</span></span>
          <span>TASKS: <span style={{ color: "#00aaff" }}>{completedTasks.length} DONE</span></span>
          {pendingApprovals.length > 0 && <span style={{ color: "#ff9900" }}>⚠ {pendingApprovals.length} PENDING APPROVAL</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "calc(100vh - 57px)" }}>
        {/* Main Panel */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #1a1a2e" }}>
          {/* Task Input */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a2e", background: "#0d0d1a" }}>
            <div style={{ fontSize: 11, color: "#444", marginBottom: 8, letterSpacing: 2 }}>DISPATCH TASK</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                style={{ background: "#111", border: "1px solid #222", color: "#888", padding: "8px 12px", borderRadius: 4, fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="auto">AUTO ROUTE</option>
                <option value="coder">CODER</option>
                <option value="researcher">RESEARCHER</option>
                <option value="planner">PLANNER</option>
              </select>
              <input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitTask()}
                placeholder="Enter task for agents..."
                style={{ flex: 1, background: "#111", border: "1px solid #222", color: "#e0e0e0", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <button
                onClick={submitTask}
                disabled={submitting || !task.trim()}
                style={{ background: submitting ? "#111" : "#00ff88", color: "#000", border: "none", padding: "8px 20px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, fontFamily: "inherit" }}
              >
                {submitting ? "..." : "DISPATCH"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a2e", background: "#0d0d1a" }}>
            {(["tasks", "approvals", "memory", "audit"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: "10px 20px", fontSize: 11, letterSpacing: 2, border: "none", background: "transparent", color: activeTab === tab ? "#00ff88" : "#444", borderBottom: activeTab === tab ? "2px solid #00ff88" : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}
              >
                {tab.toUpperCase()}
                {tab === "approvals" && pendingApprovals.length > 0 && <span style={{ marginLeft: 6, background: "#ff9900", color: "#000", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{pendingApprovals.length}</span>}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
            {activeTab === "tasks" && (
              <div>
                {activeTasks.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>ACTIVE</div>
                    {activeTasks.map((t, i) => (
                      <TaskCard key={i} task={t} agentColor={agentColor} statusBadge={statusBadge} />
                    ))}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>COMPLETED</div>
                  {completedTasks.length === 0 && <div style={{ color: "#333", fontSize: 13 }}>No completed tasks yet. Dispatch one above.</div>}
                  {completedTasks.map((t, i) => (
                    <TaskCard key={i} task={t} agentColor={agentColor} statusBadge={statusBadge} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "approvals" && (
              <div>
                <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>PENDING HUMAN APPROVAL</div>
                {pendingApprovals.length === 0 && <div style={{ color: "#333", fontSize: 13 }}>No pending approvals. Try dispatching a task with "delete" or "deploy".</div>}
                {pendingApprovals.map((a) => (
                  <div key={a.id} style={{ background: "#0d0d1a", border: "1px solid #ff990044", borderRadius: 6, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#ff9900", marginBottom: 8, letterSpacing: 1 }}>⚠ APPROVAL REQUIRED — {a.id}</div>
                    <div style={{ fontSize: 13, color: "#ccc", marginBottom: 4 }}>{a.task}</div>
                    <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>Agent: {a.agent} · {new Date(a.created_at).toLocaleTimeString()}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => resolveApproval(a.id, true)} style={{ background: "#00ff8822", border: "1px solid #00ff88", color: "#00ff88", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>APPROVE</button>
                      <button onClick={() => resolveApproval(a.id, false)} style={{ background: "#ff000022", border: "1px solid #ff4444", color: "#ff4444", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>REJECT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "memory" && (
              <div>
                <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>MEMORY GRAPH — {memoryGraph.nodes.length} NODES · {memoryGraph.edges.length} EDGES</div>
                {memoryGraph.nodes.length === 0 && <div style={{ color: "#333", fontSize: 13 }}>Memory graph is empty. Complete some tasks to populate it.</div>}
                {memoryGraph.nodes.map((n) => (
                  <div key={n.id} style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 6, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#555", letterSpacing: 1 }}>{n.node_type?.toUpperCase()} · {n.id}</span>
                      <span style={{ fontSize: 10, color: "#333" }}>{new Date(n.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>{n.content}</div>
                  </div>
                ))}
                {memoryGraph.edges.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 8 }}>RELATIONSHIPS</div>
                    {memoryGraph.edges.map((e, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
                        <span style={{ color: "#888" }}>{e.from}</span> <span style={{ color: "#00aaff" }}>—{e.relation}→</span> <span style={{ color: "#888" }}>{e.to}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "audit" && (
              <div>
                <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>AUDIT TRAIL</div>
                {auditLog.length === 0 && <div style={{ color: "#333", fontSize: 13 }}>No audit events yet.</div>}
                {auditLog.map((entry, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: "#333", whiteSpace: "nowrap" }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: "#ff9900" }}>{entry.event}</span>
                    <span style={{ color: "#666" }}>{entry.task?.slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Log Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", background: "#0a0a0f" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a2e", fontSize: 11, color: "#444", letterSpacing: 2 }}>
            LIVE FEED
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12, fontFamily: "monospace" }}>
            {liveLog.length === 0 && <div style={{ color: "#222", fontSize: 11 }}>Waiting for events...</div>}
            {liveLog.map((entry, i) => (
              <div key={i} style={{ marginBottom: 6, fontSize: 11, lineHeight: 1.6 }}>
                <span style={{ color: "#333" }}>{new Date(entry.timestamp).toLocaleTimeString()} </span>
                <span style={{ color: entry.type === "error" ? "#ff4444" : entry.type === "submit" ? "#00ff88" : "#555" }}>{entry.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
          {/* Agent Status */}
          <div style={{ borderTop: "1px solid #1a1a2e", padding: 16 }}>
            <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 12 }}>AGENTS</div>
            {["coder", "researcher", "planner"].map((a) => (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: agentColor(a), boxShadow: `0 0 6px ${agentColor(a)}` }} />
                <span style={{ fontSize: 12, color: "#666", letterSpacing: 1 }}>{a.toUpperCase()}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#333" }}>
                  {activeTasks.filter(t => t.agent === a).length > 0 ? "BUSY" : "IDLE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, agentColor, statusBadge }: { task: Task; agentColor: (n: string) => string; statusBadge: (s: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 6, padding: 14, marginBottom: 10, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: agentColor(task.agent), flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#555", letterSpacing: 1 }}>{task.agent?.toUpperCase()}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 10, background: task.status === "completed" ? "#00ff8822" : task.status === "running" ? "#00aaff22" : "#ff000022", color: task.status === "completed" ? "#00ff88" : task.status === "running" ? "#00aaff" : "#ff4444" }}>{task.status}</span>
      </div>
      <div style={{ fontSize: 13, color: "#aaa" }}>{task.task}</div>
      {expanded && task.result && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#666", borderTop: "1px solid #1a1a2e", paddingTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{task.result}</div>
      )}
      {expanded && <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>{task.started_at} {task.completed_at ? `→ ${task.completed_at}` : ""}</div>}
    </div>
  );
}