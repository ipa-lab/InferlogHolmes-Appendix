#%%
import sys
sys.path.insert(0, 'static')
import lasapp
from model_graph import *
from utils import *
import argparse

#%%
# filename = "test/coin.py"
# program = lasapp.ProbabilisticProgram(filename, n_unroll_loops=3)

# #%%
# model_graph = get_model_graph(program)
# merge_nodes_by_name(model_graph, label_method="source")

# for x,y in model_graph.edges:
#     print(x.address_node.source_text, "->", y.address_node.source_text)
#     print(x.name, "->", y.name)

# plot_model_graph(model_graph, format="svg", view=True, label_method="source")

# %%
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("filename", help="path to probabilistic program")
    parser.add_argument("-label_method", help="name | source", default="source") 
    parser.add_argument("-unroll_loops", help="int (no unrolling if set to 0)", default=3, type=int)
    parser.add_argument("--v", help="verbose: if set source code of file will be printed", action='store_true')
    parser.add_argument("--merge", help="if set, nodes will be merged by label", action='store_true')
    parser.add_argument("--view", help="if set, graph will be opened in viewer", action='store_true')
    parser.add_argument("-format", help="output format of graph (pdf, svg, png, etc)", default="pdf")
    parser.add_argument("-o", help="output filename (extension is given by format)", default="tmp/model.gv")
    args = parser.parse_args()


    filename = args.filename
    n_unroll_loops = args.unroll_loops
    label_method = args.label_method
    assert label_method in ("name", "source")

    program = lasapp.ProbabilisticProgram(filename, n_unroll_loops=n_unroll_loops)

    
    model_graph = get_model_graph(program)

    if args.v:
        file_content = get_file_content(filename)
        highlights = [(rv.node.first_byte, rv.node.last_byte, "106m" if rv.is_observed else "102m") for rv in model_graph.random_variables.values()]
        print(highlights)
        print_source_highlighted(file_content, highlights)

    if args.merge:
        merge_nodes_by_name(model_graph, label_method=args.label_method)

    if args.v:
        print("Model Graph Edges:")
        for x,y in model_graph.edges:
            if args.label_method == "name":
                print(x.name, "->", y.name)
            else:
                print(x.address_node.source_text, "->", y.address_node.source_text)
    
    
    plot_model_graph(model_graph, format=args.format, view=args.view, filename=args.o, label_method=label_method)