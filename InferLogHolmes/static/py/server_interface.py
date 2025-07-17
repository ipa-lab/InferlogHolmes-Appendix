from dataclasses import dataclass
from dataclasses_json import dataclass_json

@dataclass_json
@dataclass
class SyntaxNode:
    node_id: str
    first_byte: int
    last_byte: int
    line_no: int
    end_line_no: int
    col_offset: int
    end_col_offset: int
    source_text: str

@dataclass_json 
@dataclass
class ControlDependency:
    node: SyntaxNode
    kind: str
    control_node: SyntaxNode
    body: list[SyntaxNode]

@dataclass_json 
@dataclass
class CallGraphNode:
    caller: SyntaxNode
    called: list[SyntaxNode]


@dataclass_json
@dataclass
class Model:
    name: str
    node: SyntaxNode

@dataclass_json
@dataclass
class DistributionParam:
    name: str
    node: SyntaxNode

@dataclass_json
@dataclass
class Distribution:
    name: str
    node: SyntaxNode
    params: list[DistributionParam]

@dataclass_json
@dataclass
class RandomVariable:
    node: SyntaxNode
    name: str
    address_node: SyntaxNode
    distribution: Distribution
    is_observed: bool


@dataclass_json
@dataclass
class Interval:
    low: str
    high: str

@dataclass_json
@dataclass
class SymbolicExpression:
    expr: str