from .ppl import PPL, VariableDefinition
import ast
from ast_utils.utils import get_call_name
from .torch_distributions import parse_torch_distribution
from ast_utils.preprocess import SyntaxTree
from .preproc import Preprocessor

class Minimal(PPL):
    def __init__(self) -> None:
        super().__init__()

    def is_random_variable_definition(self, node: ast.AST) -> bool:
        match node:
            case ast.Assign(value=ast.Call(func=ast.Attribute(value=ast.Name(id=_id), attr=_attr))) if _id == "ppl" and _attr == "sample":
                return True
            case ast.Assign(value=ast.Call(func=ast.Name(id=_id))) if _id == "sample":
                return True
        return False
    
    def get_random_variable_name(self, variable: VariableDefinition) -> str:
        assert isinstance(variable.node, ast.Assign)
        call_node = variable.node.value
        return ast.unparse(call_node.args[0])
    
    def get_address_node(self, variable: VariableDefinition) -> ast.AST:
        assert isinstance(variable.node, ast.Assign)
        call_node = variable.node.value
        return call_node.args[0]

    def is_model(self, node: ast.AST) -> bool:
        return isinstance(node, ast.FunctionDef)
    
    def get_model_name(self, node) -> bool:
        return node.name
    
    def is_observed(self, variable: VariableDefinition) -> bool:
        assert isinstance(variable.node, ast.Assign)
        call_node = variable.node.value
        for kw in call_node.keywords:
            if kw.arg == 'observed':
                return True
        return False
    
    def get_distribution_node(self, variable: VariableDefinition) -> ast.AST:
        assert isinstance(variable.node, ast.Assign)
        call_node = variable.node.value
        dist_node = call_node.args[1]

        return dist_node

    
    def get_distribution(self, distribution_node: ast.AST) -> tuple[str, dict[str, ast.AST]]:
        if not isinstance(distribution_node, ast.Call):
            return "Unknown", {"distribution": distribution_node}
        
        # dist.Normal(0,1).to_event() ... -> dist.Normal(0,1)
        while isinstance(distribution_node, ast.Call) and isinstance(distribution_node.func, ast.Attribute) and isinstance(distribution_node.func.value, ast.Call):
            distribution_node = distribution_node.func.value

        name = get_call_name(distribution_node)

        args = distribution_node.args
        kwargs = {kw.arg: kw.value for kw in distribution_node.keywords}

        dist_name, dist_params = parse_torch_distribution(name, args, kwargs)

        return dist_name, dist_params
    
    def is_rogue_rv_node(self, node: ast.Call) -> bool:
        match node:
            case ast.Call(func=ast.Attribute(value=ast.Name(id=_id), attr=_attr)) if _id == "ppl" and _attr == "sample":
                return True
            case ast.Call(func=ast.Name(id=_id)) if _id == "sample":
                return True
        return False
    
    def preprocess_syntax_tree(self, syntax_tree: SyntaxTree) -> SyntaxTree:
        Preprocessor(syntax_tree, lambda node: self.is_rogue_rv_node(node)).visit(syntax_tree.root_node)
        # print(ast.dump(syntax_tree.root_node, indent=1))
        # print(ast.unparse(syntax_tree.root_node))

        root_node = syntax_tree.root_node
        assert isinstance(root_node, ast.Module)
        has_model_name = False
        for stmt in root_node.body.elts:
            match stmt:
                case ast.Assign(targets=[ast.Name(id=_name)]) if _name == "model":
                    # model = name
                    has_model_name = True
                case ast.FunctionDef(name=_name) if _name == "model":
                    # def model(...)
                    has_model_name = True

        if not has_model_name:
            # check if some function is used in inference call
            model_name = None
            for stmt in root_node.body.elts:
                match stmt:
                    case ast.Assign(value=ast.Call(func=ast.Name(id=_id), args=_args)) if _id in ("metropolis_hastings", "hamiltonian_monte_carlo"):
                        if _id == "metropolis_hastings":
                            ix = 2
                        else: # _id == "hamiltonian_monte_carlo"
                            ix = 4
                        if isinstance(_args[ix], ast.Name):
                            model_name = _args[ix].id

            if model_name is not None:
                # add model = model_name stmt
                store_node = ast.Name(id="model", ctx=ast.Store())
                load_node = ast.Name(id=model_name, ctx=ast.Load())
                node = ast.Assign(targets=[store_node], value=load_node)
                node.parent = root_node.body
                store_node.parent = node
                load_node.parent = node
                syntax_tree.add_node(store_node)
                syntax_tree.add_node(load_node)
                syntax_tree.add_node(node)
                root_node.body.elts.append(node)
                 

        return syntax_tree