import lasapp
import lasapp.distributions as dists


def get_param_with_name(distribution: lasapp.server_interface.Distribution, name: str):
    for param in distribution.params:
        if param.name == name:
            return param
    return None

def Interval(program: lasapp.ProbabilisticProgram,
             mask: dict[lasapp.SyntaxNode, lasapp.Interval],
             rv: lasapp.RandomVariable,
             _support: dists.Constraint):
    support = dists.to_interval(_support)
    if support is not None:
        # if the support contains a symbol, we statically evaluate the support first
        
        if isinstance(support.low, dists.ParamDependentBound):
            # parameter dependent support
            param = get_param_with_name(rv.distribution, support.low.param)
            if param is not None:
                estimated_range = program.estimate_value_range(
                    expr=param.node,
                    mask=mask # mask up to now, rvs are sorted
                )
                support.low = float(estimated_range.low) # probably estimated_range.low == estimated_range.high
            else:
                return None

        if isinstance(support.high, dists.ParamDependentBound):
            # parameter dependent support
            param = get_param_with_name(rv.distribution, support.high.param)
            if param is not None:
                estimated_range = program.estimate_value_range(
                    expr=param.node,
                    mask=mask # mask up to now, rvs are sorted
                )
                support.high = float(estimated_range.high) # probably estimated_range.low == estimated_range.high
            else:
                return None
            
        return lasapp.Interval(low=str(support.low), high=str(support.high))
    
    return None

def get_rv_to_support_mask(program: lasapp.ProbabilisticProgram, random_variables: list[lasapp.RandomVariable]):
    # We abstract the value of a random variable by its support.
    mask = {}
    # TODO: this has to be done in correct order, because we have to know the support of all parent rvs.
    for rv in random_variables:
        properties = lasapp.infer_distribution_properties(rv)
        if properties is not None:
            interval = Interval(program, mask, rv, properties.support)
            if interval is not None:
                mask[rv.node] = interval
            else:
                print(f"Could not mask support as interval for {rv.node.source_text}")
        else:
            print(f"Could not find properties for {rv.node.source_text}")
    return mask