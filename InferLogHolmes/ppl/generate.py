from .core import SampleContext, InferenceResult
import torch
import torch.distributions as dist
from typing import Optional
from tqdm import tqdm

class GenerateCtx(SampleContext):
    def __init__(self) -> None:
        self.trace = {}
        self.log_prob = torch.tensor(0.)

    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None):
        if observed is not None:
            self.log_prob += distribution.log_prob(observed).sum()
            return observed

        value = distribution.sample()
        self.trace[address] = value
        
        log_prob = distribution.log_prob(value)
        self.log_prob += log_prob

        return value
    
    def deterministic(self, address: str, value: torch.Tensor) -> torch.Tensor:
        self.trace[address] = value
        return value
    
def generate_from_prior(n_iter: int, model, *args, **kwargs) -> InferenceResult:

    result = []
    for i in tqdm(range(n_iter), desc="generate"):
        ctx = GenerateCtx()
        with ctx:
            retval = model(*args, **kwargs)
            
            stat = {
                "iter": i,
                "retval": retval,
                "trace": ctx.trace,
                "log_prob": ctx.log_prob,
            }
            result.append(stat)

    return result