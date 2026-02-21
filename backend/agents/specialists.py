from .base import call_llm
from datetime import datetime

class CoderAgent:
    name = "coder"
    system_prompt = """You are an expert software engineer. 
    When given a task, provide clean, production-ready code with brief explanation.
    Be concise. Focus on implementation."""

    async def run(self, task: str) -> dict:
        result = await call_llm(self.system_prompt, task)
        return {"agent": self.name, "result": result, "timestamp": datetime.utcnow().isoformat()}

class ResearcherAgent:
    name = "researcher"
    system_prompt = """You are a research analyst. 
    When given a topic, provide structured findings with key facts, tradeoffs, and recommendations.
    Be concise and factual."""

    async def run(self, task: str) -> dict:
        result = await call_llm(self.system_prompt, task)
        return {"agent": self.name, "result": result, "timestamp": datetime.utcnow().isoformat()}

class PlannerAgent:
    name = "planner"
    system_prompt = """You are a strategic project planner.
    When given a goal, break it into clear phases with tasks, dependencies, and time estimates.
    Output structured plans."""

    async def run(self, task: str) -> dict:
        result = await call_llm(self.system_prompt, task)
        return {"agent": self.name, "result": result, "timestamp": datetime.utcnow().isoformat()}