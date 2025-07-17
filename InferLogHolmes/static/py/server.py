from collections import deque
from functools import cmp_to_key
from jsonrpc_server import run_server, _SESSION

import ast
from ast_utils.scoped_tree import ScopedTree, get_scoped_tree
from ast_utils.preprocess import preprocess_syntaxtree, SyntaxTree
from ast_utils.node_finders import VariableDefinitionCollector, find_model, find_guide
from ast_utils.utils import *

from analysis.call_graph import compute_call_graph
from analysis.data_control_flow import data_deps_for_node, control_parents_for_node
import analysis.interval_arithmetic as interval_arithmetic

from ppls import *
import server_interface
import uuid

import graphviz

from model_graph import ModelGraph, Plate, merge_nodes_by_name

def get_syntax_tree(file_content: str, line_offsets: list[int], n_unroll_loops: int, uniquify_calls: bool) -> SyntaxTree:
    syntax_tree = ast.parse(file_content)
    syntax_tree = preprocess_syntaxtree(syntax_tree, file_content, line_offsets, n_unroll_loops, uniquify_calls)
    return syntax_tree

def get_variables(syntax_tree: SyntaxTree, ppl: PPL) -> list[VariableDefinition]:
    variable_collector = VariableDefinitionCollector(ppl)
    variable_collector.visit(syntax_tree.root_node)
    return variable_collector.result

def to_syntax_node(syntax_tree: SyntaxTree, node: ast.AST) -> server_interface.SyntaxNode:
    start, end = node.position, node.end_position
    node = server_interface.SyntaxNode(
        syntax_tree.node_to_id[node],
        start, end,
        node.lineno, node.end_lineno,
        node.col_offset, node.end_col_offset,
        source_text(node))
    return node

def to_random_variable(syntax_tree: SyntaxTree, variable: VariableDefinition, ppl: PPL, is_observed: bool) -> server_interface.RandomVariable:
    name = ppl.get_random_variable_name(variable)
    address_node = to_syntax_node(syntax_tree, ppl.get_address_node(variable))

    node = to_syntax_node(syntax_tree, variable.node)

    distribution_node = ppl.get_distribution_node(variable)
    dist_name, dist_params = ppl.get_distribution(distribution_node)

    distribution = server_interface.Distribution(
        dist_name,
        to_syntax_node(syntax_tree, distribution_node),
        [server_interface.DistributionParam(k, to_syntax_node(syntax_tree, v)) for k,v in dist_params.items()]
        )

    return server_interface.RandomVariable(node, name, address_node, distribution, is_observed)

_PPL_DICT: dict[str, PPL] =  {
    "minimal": Minimal(),
    "pymc": PyMC(),
}

def build_ast(file_name: str, ppl: str, n_unroll_loops: int) -> str:
    print("build_ast")
    print("FILENAME:", file_name)
    line_offsets = get_line_offsets(file_name)
    file_content = get_file_content(file_name)

    if ppl is None:
        if 'pyro' in file_content:
            ppl = 'pyro'
        elif 'pymc' in file_content:
            ppl = 'pymc'
        elif 'Turing' in file_content:
            ppl = 'turing'
        elif 'beanmachine' in file_content:
            ppl = 'beanmachine'
        elif 'Gen' in file_content:
            ppl = 'gen'
        else:
            ppl = 'minimal'


    print("PPL:", ppl)
    
    ppl_obj = _PPL_DICT[ppl]
    uniquify_calls = ppl != "beanmachine"
    syntax_tree = get_syntax_tree(file_content, line_offsets, n_unroll_loops, uniquify_calls)
    syntax_tree = ppl_obj.preprocess_syntax_tree(syntax_tree)

    scoped_tree = get_scoped_tree(syntax_tree)
    uuid4 = str(uuid.uuid4())
    _SESSION[uuid4] = ppl_obj, scoped_tree
    return uuid4

def get_model(tree_id: str) -> server_interface.Model:
    print("get_model")
    ppl_obj, scoped_tree = _SESSION[tree_id]

    model = find_model(scoped_tree.root_node, ppl_obj)

    return server_interface.Model(model.name, to_syntax_node(scoped_tree.syntax_tree, model.node))

def get_random_variables(tree_id: str) -> list[server_interface.RandomVariable]:
    print("get_random_variables")

    ppl_obj, scoped_tree = _SESSION[tree_id]

    variables = get_variables(scoped_tree.syntax_tree, ppl_obj)

    response = []
    for variable in variables:
        v = to_random_variable(scoped_tree.syntax_tree, variable, ppl_obj, ppl_obj.is_observed(variable))
        response.append(v)

    return response


def get_data_dependencies(tree_id: str, node: dict) -> list[server_interface.SyntaxNode]:
    print("get_data_dependencies")

    _, scoped_tree = _SESSION[tree_id]

    node = scoped_tree.get_node_for_id(node["node_id"])
    data_deps = data_deps_for_node(scoped_tree, node)
    response = [to_syntax_node(scoped_tree.syntax_tree, dep) for dep in data_deps]
    return response

def get_control_dependencies(tree_id: str, node: dict) -> list[server_interface.ControlDependency]:
    print("get_control_dependencies")

    _, scoped_tree = _SESSION[tree_id]

    node = scoped_tree.get_node_for_id(node["node_id"])
    control_deps = control_parents_for_node(scoped_tree, node)
    response = []
    for dep in control_deps:
        if isinstance(dep, ast.If):
            kind = "if"
            control_node = dep.test
            body = [to_syntax_node(scoped_tree.syntax_tree, dep.body)]
            if hasattr(dep, "orelse"):
                body.append(to_syntax_node(scoped_tree.syntax_tree, dep.orelse))
        elif isinstance(dep, ast.While):
            kind = "while"
            control_node = dep.test
            body = [to_syntax_node(scoped_tree.syntax_tree, dep.body)]
        elif isinstance(dep, ast.For):
            kind = "for"
            control_node = dep.iter
            body = [to_syntax_node(scoped_tree.syntax_tree, dep.body)]
            
        response.append(server_interface.ControlDependency(
            to_syntax_node(scoped_tree.syntax_tree, dep),
            kind,
            to_syntax_node(scoped_tree.syntax_tree, control_node),
            body
        ))

    return response


def estimate_value_range(tree_id: str, expr: dict, mask: list[tuple[dict, dict]]) -> server_interface.Interval:
    print("estimate_value_range")

    _, scoped_tree = _SESSION[tree_id]

    # mask is a list[tuple[SyntaxNode, Interval]]
    valuation = {}
    for _node, interval in mask:
        _node = server_interface.SyntaxNode.from_dict(_node)
        interval = server_interface.Interval.from_dict(interval)
        parsed_interval = interval_arithmetic.Interval(float(interval.low), float(interval.high))
        node = scoped_tree.get_node_for_id(_node.node_id)
        if isinstance(node, ast.Assign):
            program_variable_symbol = get_assignment_name(node).id
            valuation[program_variable_symbol] = parsed_interval
        elif isinstance(node, ast.FunctionDef):
            program_variable_symbol = node.name
            valuation[program_variable_symbol] = parsed_interval
        else:
            print(f"Cannot mask node of type {type(node)} {source_text(node)}.")

    expr = server_interface.SyntaxNode.from_dict(expr)
    node_to_evaluate = scoped_tree.get_node_for_id(expr.node_id)

    res = interval_arithmetic.static_interval_eval(scoped_tree, node_to_evaluate, valuation)

    return server_interface.Interval(str(res.low), str(res.high))

def get_call_graph(tree_id: str, node: dict) -> list[server_interface.CallGraphNode]:
    print("get_call_graph")

    _, scoped_tree = _SESSION[tree_id]

    node = scoped_tree.get_node_for_id(node["node_id"])

    call_graph = compute_call_graph(scoped_tree.root_node, scoped_tree.scope_info, node)

    call_nodes = []
    for caller, called in call_graph.items():
        call_nodes.append(server_interface.CallGraphNode(
            to_syntax_node(scoped_tree.syntax_tree, caller),
            [to_syntax_node(scoped_tree.syntax_tree, c) for c in called]
        ))
    
    return call_nodes

def plot_model_graph(model_graph, label_method="name"):

    def get_graph(plate, graph=None):
        if graph is None:
            graph = graphviz.Digraph(
                name='cluster_'+plate.control_dep.node.node_id,
                # graph_attr={'label': plate.control_dep["controlsub_node"]["source_text"]}
                )
        
        for m in plate.members:
            if isinstance(m, Plate):
                subgraph = get_graph(m)
                graph.subgraph(subgraph)
            else:
                rv = model_graph.random_variables[m]
                if label_method == "name":
                    label = f"{rv.name}\n~ {rv.distribution.name}"
                elif label_method == "source":
                    label = f"{rv.address_node.source_text}\n~ {rv.distribution.name}"
                else:
                    raise Exception(f"Unknown label method {label_method}")
                # for p in rv.distribution.params:
                #     label += f"\n{p.name} = {p.node.source_text}"
                if rv.is_observed:
                    graph.node(m, label, style="filled", fillcolor="gray")
                else:
                    graph.node(m, label)
        return graph

    dot = graphviz.Digraph('model', engine="dot")
    dot = get_graph(model_graph.plates["global"],graph=dot)

    for x,y in model_graph.edges:
        dot.edge(x.node.node_id, y.node.node_id)

    return dot.pipe(format='svg', encoding='utf-8')


def get_graph(tree_id: str, model: any):
    _, scoped_tree = _SESSION[tree_id]

    temp_rv = get_random_variables(tree_id)
    random_variables = { rv.node.node_id: rv for rv in temp_rv }

    edges = []
    plates = {"global": Plate(None)}

    for _, rv in random_variables.items():
        marked = set()
        # we recursively get all data and control dependencies of random variable node
        queue = deque([rv.address_node, rv.distribution.node])

        while len(queue) > 0:
            # get next node, FIFO
            node = queue.popleft()

            # get all data dependencies
            data_deps = get_data_dependencies(tree_id, node.__dict__)

            for dep in data_deps:
                # check if we have already processed node
                if dep.node_id not in marked:
                    if dep.node_id in random_variables:
                        # if node is random variable, we do not continue recursion and add edge to graph
                        dep_rv = random_variables[dep.node_id]
                        edges.append((dep_rv, rv))

                        queue.append(dep_rv.address_node)
                        marked.add(dep_rv.address_node.node_id)
                    else:
                        queue.append(dep)
                    marked.add(dep.node_id)
            
            # get all control dependencies, this are loop / if nodes
            for dep in get_control_dependencies(tree_id, node.__dict__):
                # get data dependencies of condition / loop variable (control subnode) of control node
                if dep.control_node.node_id not in marked:
                    queue.append(dep.control_node)
                    marked.add(dep.control_node.node_id)
                    

    # compute plates from control_parents
    for _, rv in random_variables.items():
        control_deps = get_control_dependencies(tree_id, rv.node.__dict__)
        control_deps = sorted(control_deps, key=cmp_to_key(lambda c1, c2: is_descendant(c1.node, c2.node)))
        current_plate = plates["global"]
        for dep in control_deps:
            if dep.kind == "for":
                dep_node_id = dep.node.node_id
                if dep_node_id not in plates:
                    plates[dep_node_id] = Plate(dep)
                current_plate.members.add(plates[dep_node_id])
                current_plate = plates[dep_node_id]

        current_plate.members.add(rv.node.node_id)


    model_graph = ModelGraph(random_variables, plates, edges)
    merge_nodes_by_name(model_graph, "source")
    
    return plot_model_graph(model_graph)


from collections import deque
def get_funnel_relationships(tree_id: str, model: any):
    print("get_funnel_relationships")
    random_variables = {rv.node.node_id: rv for rv in get_random_variables(tree_id)}

    funnel_deps = []    

    for _, rv in random_variables.items():
        for param in rv.distribution.params:

            if param.name == 'scale':
                marked = set()
                queue = deque([param.node])
                while len(queue) > 0:
                    node = queue.popleft()
                    data_deps = get_data_dependencies(tree_id, node.__dict__)
                    for dep in data_deps:
                        if dep.node_id not in marked:
                            if dep.node_id in random_variables:
                                # if node is random variable, we do not continue recursion and add edge to graph
                                dep_rv = random_variables[dep.node_id]
                                funnel_deps.append((rv,dep_rv))
                            else:
                                queue.append(dep)
                            marked.add(dep.node_id)


    print(funnel_deps)
    return funnel_deps

import sys
from jsonrpc import JSONRPCResponseManager, dispatcher
import os
from pathlib import Path
from werkzeug.wrappers import Request, Response
from werkzeug.serving import run_simple

@Request.application
def application(request):
    # Dispatcher is dictionary {<method_name>: callable}
    dispatcher["build_ast"] = build_ast
    dispatcher["get_random_variables"] = get_random_variables
    dispatcher["get_model"] = get_model
    dispatcher["get_data_dependencies"] = get_data_dependencies
    dispatcher["get_control_dependencies"] = get_control_dependencies
    dispatcher["estimate_value_range"] = estimate_value_range
    dispatcher["get_call_graph"] = get_call_graph
    dispatcher["get_graph"] = get_graph
    dispatcher["get_funnel_relationships"] = get_funnel_relationships

    response = JSONRPCResponseManager.handle(
        request.data, dispatcher)
    return Response(response.json, mimetype='application/json')

if __name__ == '__main__':
    # socket_name = sys.argv[1]
    Path("./.pipe").mkdir(exist_ok=True)
    socket_name = "./.pipe/python_rpc_socket"

    if os.path.exists(socket_name):
        os.remove(socket_name)

    print("Started Python Language Server", socket_name)
    run_simple('localhost', 4000, application)

    #dispatcher["build_ast"] = build_ast
    #dispatcher["get_random_variables"] = get_random_variables
    #dispatcher["get_model"] = get_model
    #dispatcher["get_data_dependencies"] = get_data_dependencies
    #dispatcher["get_control_dependencies"] = get_control_dependencies
    #dispatcher["estimate_value_range"] = estimate_value_range
    #dispatcher["get_call_graph"] = get_call_graph
#
    #run_server(socket_name, dispatcher)