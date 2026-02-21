import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import os
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
from orchestrator.core import AgentOrchestrator

app = FastAPI(title="Multi-Agent Orchestrator")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

orchestrator = AgentOrchestrator()
connected_clients: list[WebSocket] = []
print("KEY LOADED:", OPENROUTER_API_KEY[:10] if OPENROUTER_API_KEY else "NONE - NOT FOUND")

async def broadcast(message: dict):
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except:
            pass

# --- REST Routes ---
class TaskRequest(BaseModel):
    task: str
    agent: Optional[str] = None

@app.get("/health")
async def health():
    return {"status": "online", "agents": list(orchestrator.agents.keys())}

@app.post("/task")
async def submit_task(req: TaskRequest):
    result = await orchestrator.run_task(req.task, req.agent, broadcast=broadcast)
    return result

@app.get("/tasks")
async def get_tasks():
    return {
        "active": orchestrator.active_tasks,
        "completed": orchestrator.completed_tasks[-20:]  # last 20
    }

@app.get("/memory")
async def get_memory():
    return orchestrator.memory.get_all()

@app.get("/approvals/pending")
async def get_pending():
    return orchestrator.governance.get_pending()

@app.get("/audit")
async def get_audit():
    return orchestrator.governance.get_audit_log()

class ApprovalRequest(BaseModel):
    approved: bool
    reason: Optional[str] = ""

@app.post("/approvals/{request_id}")
async def resolve_approval(request_id: str, req: ApprovalRequest):
    result = orchestrator.governance.resolve(request_id, req.approved, req.reason)
    await broadcast({"type": "approval_resolved", "request_id": request_id, "approved": req.approved})
    return result

# --- WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        connected_clients.remove(websocket)