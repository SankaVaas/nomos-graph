import asyncio
from agents.specialists import CoderAgent, ResearcherAgent, PlannerAgent
from memory.graph import MemoryGraph, NodeType, RelationType
from governance.approval import ApprovalWorkflow
from datetime import datetime

class AgentOrchestrator:
    def __init__(self):
        self.memory = MemoryGraph()
        self.governance = ApprovalWorkflow()
        self.agents = {
            "coder": CoderAgent(),
            "researcher": ResearcherAgent(),
            "planner": PlannerAgent()
        }
        self.active_tasks: list = []
        self.completed_tasks: list = []

    def route_task(self, task: str) -> str:
        """Simple keyword routing to pick the right agent"""
        task_lower = task.lower()
        if any(w in task_lower for w in ["code", "implement", "function", "debug", "build"]):
            return "coder"
        elif any(w in task_lower for w in ["research", "find", "analyze", "compare", "what is"]):
            return "researcher"
        else:
            return "planner"

    async def run_task(self, task: str, agent_name: str = None, broadcast=None) -> dict:
        agent_name = agent_name or self.route_task(task)
        agent = self.agents[agent_name]

        # Check governance
        if self.governance.requires_approval(task):
            request_id = self.governance.create_request(task, agent_name)
            if broadcast:
                await broadcast({
                    "type": "approval_required",
                    "request_id": request_id,
                    "task": task,
                    "agent": agent_name
                })
            return {"status": "pending_approval", "request_id": request_id}

        # Log task start
        task_record = {
            "task": task, "agent": agent_name,
            "status": "running", "started_at": datetime.utcnow().isoformat()
        }
        self.active_tasks.append(task_record)

        if broadcast:
            await broadcast({"type": "task_started", **task_record})

        try:
            result = await agent.run(task)

            # Store in memory graph
            task_node = self.memory.add_node(task, NodeType.TASK, {"agent": agent_name})
            result_node = self.memory.add_node(result["result"][:200], NodeType.FACT, {"agent": agent_name})
            self.memory.add_relation(result_node, task_node, RelationType.GENERATED_BY)

            task_record["status"] = "completed"
            task_record["result"] = result["result"]
            task_record["completed_at"] = datetime.utcnow().isoformat()

            self.active_tasks.remove(task_record)
            self.completed_tasks.append(task_record)

            if broadcast:
                await broadcast({"type": "task_completed", **task_record})

            return {"status": "completed", "result": result}

        except Exception as e:
            task_record["status"] = "failed"
            task_record["error"] = str(e)
            self.active_tasks.remove(task_record)
            if broadcast:
                await broadcast({"type": "task_failed", **task_record})
            print(f"Task failed: {e}")
            return {"status": "failed", "error": str(e)}