import torch
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from .core import InferenceResult

def get_trace_at_address(result: InferenceResult, address: str):
    return torch.hstack([stat["trace"][address] for stat in result])

def get_return_values(result: InferenceResult):
    return [stat["retval"] for stat in result]

def plot_chain_for_address(result: InferenceResult, address: str):
    trace = get_trace_at_address(result, address)
    sns.lineplot(trace)
    plt.ylabel(address)
    plt.xlabel("iteration")
    plt.title(f"Traceplot for {address} (n={len(trace)})")
    plt.show()

def plot_histogram_for_address(result: InferenceResult, address: str):
    trace = get_trace_at_address(result, address)
    sns.histplot(trace, kde=True) # TODO: normalise
    plt.xlabel(address)
    plt.title(f"Histogram for {address} (n={len(trace)})")
    plt.show()
    
def pair_plot(result: InferenceResult, address1: str, address2: str, levelsalpha: float = 0.5, alpha: float = 0.5, x_log_scale=False, y_log_scale=False, show_diverged=False):
    trace1 = get_trace_at_address(result, address1)
    trace2 = get_trace_at_address(result, address2)

    data = pd.DataFrame({address1: trace1, address2: trace2})

    sns.kdeplot(data, x=address1, y=address2, alpha=levelsalpha, log_scale=(x_log_scale, y_log_scale))
    sns.scatterplot(data, x=address1, y=address2, alpha=alpha)
    if show_diverged:
        mask = torch.tensor([r["diverged"] for r in result]).numpy()
        sns.scatterplot(data[mask], x=address1, y=address2, color="red")
    plt.title(f"Pairplot {address1} vs {address2}")
    plt.show()