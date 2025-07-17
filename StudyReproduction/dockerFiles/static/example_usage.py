
import sys
sys.path.insert(0, 'static')
import lasapp
from utils import *
import argparse
from model_graph import *
from param_range import *

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("filename", help="path to probabilistic program")
    parser.add_argument("--viewgraph", action='store_true')
    args = parser.parse_args()

    filename = args.filename

    program = lasapp.ProbabilisticProgram(filename, n_unroll_loops=0)

    model = program.get_model()
    random_variables = get_random_variables(program, model)

    model_graph = get_model_graph(program)
    if args.viewgraph:
        plot_model_graph(model_graph)

    mask = get_rv_to_support_mask(program, random_variables)

    for rv in random_variables:
        print(rv)
        print("  name:", rv.name)
        print("  address node:", rv.address_node.source_text)
        print("  is observed:", rv.is_observed)
        print("  distribution:", rv.distribution.node.source_text)
        properties = lasapp.infer_distribution_properties(rv)
        print("    properties:", "    ".join(str(properties).splitlines(True)))
        for param in rv.distribution.params:
            value_range = program.estimate_value_range(param.node, mask)
            value_range = dists.Interval(float(value_range.low), float(value_range.high))
            print("    param:", param.name, "->", param.node.source_text, f"(estimated range: {value_range})")
        print(f"  position: {rv.node.line_no}:{rv.node.col_offset} - {rv.node.end_line_no}:{rv.node.end_col_offset}")
        print("  dependencies:", [x for (x,y) in model_graph.edges if y == rv])



