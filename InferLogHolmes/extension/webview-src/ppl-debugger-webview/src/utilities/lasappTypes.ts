
export type SyntaxNode = {
    node_id: string,
    first_byte: number,
    last_byte: number,
    line_no: number,
    end_line_no: number,
    col_offset: number,
    end_col_offset: number,
    source_text: string,
}


export type ControlDependency = {
    node: SyntaxNode,
    kind: string,
    control_node: SyntaxNode,
    body: [SyntaxNode],
}


export type CallGraphNode = {
    caller: SyntaxNode,
    called: [SyntaxNode],
}


export type Model = {
    name: string,
    node: SyntaxNode,
}

export type DistributionParam = {
    name: string,
    node: SyntaxNode,
}

export type Distribution = {
    name: string,
    node: SyntaxNode,
    params: [DistributionParam],
}

export type RandomVariable = {
    node: SyntaxNode,
    name: string,
    address_node: SyntaxNode,
    distribution: Distribution,
    is_observed: boolean,
}

export type Interval = {
    low: string,
    high: string,
}

export type SymbolicExpression = {
    expr: string,
}

export type TraceItem = {
	iter: number,
	trace_current: any,
	log_prob_current: number,
	trace_proposed: any,
	log_prob_proposed: number,
	accepted: boolean | boolean[],
	diverged: boolean,
	resample_addresses: any[] | undefined
}