import networkx as nx
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import uuid

class RelationType(str, Enum):
    RELATED_TO = "RelatedTo"
    UPDATES = "Updates"
    CONTRADICTS = "Contradicts"
    DEPENDS_ON = "DependsOn"
    GENERATED_BY = "GeneratedBy"

class NodeType(str, Enum):
    FACT = "fact"
    DECISION = "decision"
    PREFERENCE = "preference"
    TASK = "task"

class MemoryGraph:
    def __init__(self):
        self.graph = nx.DiGraph()
    
    def add_node(self, content: str, node_type: NodeType, metadata: dict = {}) -> str:
        node_id = str(uuid.uuid4())[:8]
        self.graph.add_node(node_id, 
            content=content,
            node_type=node_type,
            metadata=metadata,
            created_at=datetime.utcnow().isoformat()
        )
        return node_id
    
    def add_relation(self, from_id: str, to_id: str, relation: RelationType):
        self.graph.add_edge(from_id, to_id, relation=relation)
    
    def get_context(self, node_id: str, depth: int = 2) -> list:
        """Get a node and its neighbors up to depth hops away"""
        nodes = nx.ego_graph(self.graph, node_id, radius=depth).nodes(data=True)
        return [{"id": n, **data} for n, data in nodes]
    
    def get_all(self) -> dict:
        return {
            "nodes": [{"id": n, **data} for n, data in self.graph.nodes(data=True)],
            "edges": [{"from": u, "to": v, "relation": d["relation"]} 
                      for u, v, d in self.graph.edges(data=True)]
        }