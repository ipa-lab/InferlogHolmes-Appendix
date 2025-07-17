import torch
import torch.distributions as dist
from typing import Dict, List, NewType, Optional
from abc import ABC, abstractmethod

_SAMPLE_CONTEXT = None

class SampleContext(ABC): # abstract class
    # start of with block
    def __enter__(self):
        global _SAMPLE_CONTEXT
        _SAMPLE_CONTEXT = self

    # end of with block
    def __exit__(self, *args):
        global _SAMPLE_CONTEXT
        _SAMPLE_CONTEXT = None
        
    @abstractmethod
    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None) -> torch.Tensor:
        raise NotImplementedError

def sample(address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None) -> torch.Tensor:
    global _SAMPLE_CONTEXT
    assert isinstance(address, str), f"Address argument {address} ({type(address)}) is not of type str."
    assert isinstance(distribution, dist.Distribution), f"Distribution argument {distribution} ({type(distribution)}) is not of type torch.distributions.Distribution."
    assert observed is None or isinstance(observed, torch.Tensor), f"Observed argument {observed} ({type(observed)}) is not of type torch.Tensor or None."
    
    # default behavior
    if _SAMPLE_CONTEXT is None:
        if observed is not None:
            return observed
        return distribution.sample()
    
    # context specific behavior
    return _SAMPLE_CONTEXT.sample(address, distribution, observed)

def deterministic(address: str, value: torch.Tensor) -> torch.Tensor:
    return value    

InferenceResult = NewType('InferenceResult', List[Dict])