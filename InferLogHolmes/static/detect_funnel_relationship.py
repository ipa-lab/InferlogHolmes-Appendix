
import py.lasapp as lasapp

def is_descendant(parent: lasapp.SyntaxNode, child: lasapp.SyntaxNode):
    return parent.first_byte <= child.first_byte and child.last_byte <= parent.last_byte


def get_random_variables(program: lasapp.ProbabilisticProgram, model: lasapp.Model):
    call_graph = program.get_call_graph(model.node)
    call_graph_nodes = {n.caller for n in call_graph}

    all_variables = program.get_random_variables()
    # get all random variables in file that are reachable from model
    random_variables = [rv for rv in all_variables if any(is_descendant(call_graph_node, rv.node) for call_graph_node in call_graph_nodes)]
    return random_variables

from collections import deque
def get_funnel_relationships(program: lasapp.ProbabilisticProgram, model: lasapp.Model):
    random_variables = {rv.node.node_id: rv for rv in get_random_variables(program, model)}

    funnel_deps = []    

    for _, rv in random_variables.items():
        for param in rv.distribution.params:

            if param.name == 'scale':
                marked = set()
                queue = deque([param.node])
                while len(queue) > 0:
                    node = queue.popleft()
                    data_deps = program.get_data_dependencies(node)
                    for dep in data_deps:
                        if dep.node_id not in marked:
                            if dep.node_id in random_variables:
                                # if node is random variable, we do not continue recursion and add edge to graph
                                dep_rv = random_variables[dep.node_id]
                                funnel_deps.append((rv,dep_rv))
                            else:
                                queue.append(dep)
                            marked.add(dep.node_id)


    return funnel_deps


import argparse
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("filename", help="path to probabilistic program")
    args = parser.parse_args()


    filename = args.filename
    program = lasapp.ProbabilisticProgram(filename, n_unroll_loops=0)

    model = program.get_model()

    funnel_deps = get_funnel_relationships(program, model)

    print("Funnel dependencies:")
    for x,y in funnel_deps:
        print(x.node.source_text, "->", y.node.source_text)

                

                