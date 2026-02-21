from datetime import datetime
from enum import Enum
from typing import Optional
import uuid

class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# Sensitive keywords that trigger approval workflow
SENSITIVE_TRIGGERS = [
    "delete", "deploy", "production", "payment", 
    "credential", "password", "secret", "drop database"
]

class ApprovalWorkflow:
    def __init__(self):
        self.pending: dict = {}
        self.audit_log: list = []
    
    def requires_approval(self, task: str) -> bool:
        return any(word in task.lower() for word in SENSITIVE_TRIGGERS)
    
    def create_request(self, task: str, agent: str) -> str:
        request_id = str(uuid.uuid4())[:8]
        self.pending[request_id] = {
            "id": request_id,
            "task": task,
            "agent": agent,
            "status": ApprovalStatus.PENDING,
            "created_at": datetime.utcnow().isoformat()
        }
        self._log("APPROVAL_REQUESTED", request_id, task, agent)
        return request_id
    
    def resolve(self, request_id: str, approved: bool, reason: str = "") -> dict:
        if request_id not in self.pending:
            return {"error": "Request not found"}
        
        request = self.pending[request_id]
        request["status"] = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        request["resolved_at"] = datetime.utcnow().isoformat()
        request["reason"] = reason
        
        self._log("APPROVAL_RESOLVED", request_id, request["task"], request["agent"], 
                  extra={"approved": approved, "reason": reason})
        return request
    
    def _log(self, event: str, request_id: str, task: str, agent: str, extra: dict = {}):
        self.audit_log.append({
            "event": event,
            "request_id": request_id,
            "task": task,
            "agent": agent,
            "timestamp": datetime.utcnow().isoformat(),
            **extra
        })
    
    def get_pending(self) -> list:
        return [r for r in self.pending.values() if r["status"] == ApprovalStatus.PENDING]
    
    def get_audit_log(self) -> list:
        return self.audit_log