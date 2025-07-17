from .core import SampleContext
from collections import namedtuple
from abc import ABC, abstractmethod
import torch
import torch.distributions as dist
from typing import Optional
from tqdm import tqdm
import requests
import simplejson as json

class AddressToIndexCtx(SampleContext):
    def __init__(self):
        self.address_to_index = {}
        self.address_to_mean = {}
    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None):
        if observed is not None:
            return observed
        assert address not in self.address_to_index, f"Address with multiple samples: {address}"
        self.address_to_index[address] = len(self.address_to_index)
        self.address_to_mean[address] = distribution.mean
        return distribution.mean
    
def get_address_to_index_map(model, *args, **kwargs):
    ctx = AddressToIndexCtx()
    with ctx:
        model(*args, **kwargs)
    return ctx.address_to_index, ctx.address_to_mean
    
        
TraceEntry = namedtuple("TraceEntry", ["value", "log_prob"])

class LogJointCtx(SampleContext):
    def __init__(self, address_to_index: dict[str,int], X: torch.Tensor):
        self.log_prob = torch.tensor(0.)
        self.address_to_index = address_to_index
        self.X = X
        self.X_trace = {}
        
    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None):
        if observed is not None:
            self.log_prob += distribution.log_prob(observed)
            return observed

        i = self.address_to_index[address]
        value = self.X[i]
        log_prob = distribution.log_prob(value)
        
        self.log_prob += log_prob
        self.X_trace[address] = TraceEntry(value, log_prob)
        
        return value
        
class AbstractLogJoint:
    pass

class LogJoint(AbstractLogJoint):
    def __init__(self, model, *args, **kwargs):
        self.model = model
        self.args = args
        self.kwargs = kwargs
        self.address_to_index, self.address_to_mean = get_address_to_index_map(model, *args, **kwargs)
        self.N = len(self.address_to_index)
        
    def __call__(self, X: torch.Tensor) -> torch.Tensor:
        ctx = LogJointCtx(self.address_to_index, X)
        with ctx:
            retval = self.model(*self.args, **self.kwargs)
        return ctx.log_prob, retval, ctx.X_trace
    

class UnconstrainedLogJointCtx(SampleContext):
    def __init__(self, address_to_index: dict[str,int], X: torch.Tensor):
        self.log_prob = torch.tensor(0.)
        self.address_to_index = address_to_index
        self.X = X
        self.X_constrained = {}
        
    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None):
        if observed is not None:
            self.log_prob += distribution.log_prob(observed)
            return observed

        i = self.address_to_index[address]
        unconstrained_value = self.X[i]

        transform = dist.transform_to(distribution.support) # unconstrained to constrained = T^{-1}
        constrained_value = transform(unconstrained_value)
        
        unconstrained_distribution = dist.TransformedDistribution(distribution, transform.inv) # supported on (-inf,inf)
        log_prob = unconstrained_distribution.log_prob(unconstrained_value)
        self.log_prob += log_prob
        
        # or equivalently
        # self.log_prob += distribution.log_prob(constrained_value) + transform.log_abs_det_jacobian(unconstrained_value, constrained_value)
        
        self.X_constrained[address] = TraceEntry(
            constrained_value.detach(), distribution.log_prob(constrained_value.detach())
        )
        
        return constrained_value
        
class UnconstrainedLogJoint(AbstractLogJoint):
    def __init__(self, model, *args, **kwargs):
        self.model = model
        self.args = args
        self.kwargs = kwargs
        self.address_to_index, _ = get_address_to_index_map(model, *args, **kwargs)
        self.N = len(self.address_to_index)
        
    def __call__(self, X: torch.Tensor) -> torch.Tensor:
        ctx = UnconstrainedLogJointCtx(self.address_to_index, X)
        with ctx:
            retval = self.model(*self.args, **self.kwargs)
        return ctx.log_prob, retval, ctx.X_constrained
    
def get_grad_U(logjoint: AbstractLogJoint):
    def grad_U(X: torch.Tensor):
        X = X.detach().requires_grad_(True)
        log_prob, _, _ = logjoint(X)
        U = -log_prob
        U.backward()
        return X.grad
    return grad_U


# The leapfrog integrated runs for L steps with stride eps.
# It has the property that leapfrog(*leapfrog(R, X, L, eps), L, eps) == (R, X)
def leapfrog(
        grad_U,
        X: torch.Tensor, P: torch.Tensor,
        L: int, eps: float
    ):
    P = P - eps/2 * grad_U(X)
    for _ in range(L-1):
        X = X + eps * P
        P = P - eps * grad_U(X)
    X = X + eps * P
    P = P - eps/2 * grad_U(X)
    
    return X, -P


def hamiltonian_monte_carlo_worker(n_iter: int, chain: int, L: int, eps: float, unconstrained: bool, model, *args, **kwargs):
    if unconstrained:
        logjoint = UnconstrainedLogJoint(model, *args, **kwargs)
        K = logjoint.N
        X_current = torch.zeros(K)
    else:
        logjoint = LogJoint(model, *args, **kwargs)
        K = logjoint.N
        X_current = torch.zeros(K)
        # initialise to mean
        for addr, value in logjoint.address_to_mean.items():
            X_current[logjoint.address_to_index[addr]] = value

    grad_U = get_grad_U(logjoint)
    
    log_prob_current, retval_current, X_unconstrained_current = logjoint(X_current)
    U_current = -log_prob_current

    result = []
    retvals = []
    stats = []
    n_accept = 0
    for i in tqdm(range(n_iter), desc=f"HMC-Chain-{chain}", position=chain):        
        # Sample K-dimensional momentum randomly
        P_current = dist.Normal(0., 1.).sample((K,))
        K_current = P_current.dot(P_current) / 2
        # Simulate trajectory with leapfrog integrator
        try:
            X_proposed, P_proposed = leapfrog(grad_U, X_current, P_current, L, eps)

            # Compute new kinetic and potential energy     
            K_proposed = P_proposed.dot(P_proposed) / 2
            log_prob_proposed, retval_proposed, X_unconstrained_proposed = logjoint(X_proposed)
            U_proposed = -log_prob_proposed

            # With perfect precision the leapfrog integrator should preserve the energy and accept with probability 1.
            # But it is an approximation and we adjust with a metropolis hasting step
            accepted = False
            if torch.rand(()).log() < (U_current - U_proposed + K_current - K_proposed):
                n_accept += 1
                accepted = True
                retval_current = retval_proposed
                U_current = U_proposed
                X_current = X_proposed
                X_unconstrained_current = X_unconstrained_proposed

            diverged = U_proposed.isnan().item() or U_proposed.isinf().item()

        except ValueError:
            # stepped out of bounds of support (invalid args)
            accepted = False
            diverged = True
            log_prob_proposed = torch.tensor(-torch.inf)
            X_unconstrained_proposed = {}

        stat = {
            "iter": i,
            "chain": chain,
            "trace_current": {k: v.value for k, v in X_unconstrained_current.items()},
            "log_prob_current": log_prob_current,
            "trace_proposed": {k: v.value for k, v in X_unconstrained_proposed.items()},
            "log_prob_proposed": log_prob_proposed,
            "accepted": accepted,
            "diverged": diverged
        }
        stats.append(stat)
        
        jsonStat = {
            "iter": i,
            "chain": chain,
            "trace_current": {k: v.item() for k, v in stat["trace_current"].items()},
            "log_prob_current": stat["log_prob_current"].item(),
            "trace_proposed": {k: v.item() for k, v in stat["trace_proposed"].items()},
            "log_prob_proposed": stat["log_prob_proposed"].item(),
            "accepted": accepted,
            "diverged": diverged,
        }
        # TODO: make API call here
        requests.post('http://localhost:8484/trace', data=json.dumps(jsonStat, ignore_nan=True))

        # Store regardless of acceptance
        result.append(X_unconstrained_current)
        retvals.append(retval_current)

    # print(f"Acceptance ratio: {n_accept/n_iter:.4f}")

    return result, stats, retvals

import multiprocess
# for MACOS: set OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
# https://stackoverflow.com/questions/50168647/multiprocessing-causes-python-to-crash-and-gives-an-error-may-have-been-in-progr

# from multiprocessing import Pool

class HMCPayload(object):
    def __init__(self, seed: int,  n_iter: int, chain: int, L: int, eps: float, unconstrained: bool, model, args, kwargs) -> None:
        self.n_iter = n_iter
        self.seed = seed
        self.chain = chain
        self.L = L
        self.eps = eps
        self.unconstrained = unconstrained
        self.model = model
        self.args = args
        self.kwargs = kwargs

def exec_hmc_payload(payload: HMCPayload):
    torch.manual_seed(payload.seed)
    return hamiltonian_monte_carlo_worker(payload.n_iter, payload.chain, payload.L, payload.eps, payload.unconstrained, payload.model, *payload.args, **payload.kwargs)


def hamiltonian_monte_carlo(n_iter: int, n_chains: int, L: int, eps: float, unconstrained: bool, model, *args, **kwargs):
    assert n_chains > 0

    requests.post('http://localhost:8484/start', json={
        "method": "hmc",
        "params": {
            "totalIteration": n_iter,
            "chains": n_chains,
            "L": L,
            "epsilon": eps
        }
    })

    if n_chains == 1:
        result, stats, retvals = hamiltonian_monte_carlo_worker(n_iter, 0, L, eps, unconstrained, model, *args, **kwargs)
        print(f"HMC acceptance ratio:", sum(stat["accepted"] for stat in stats[0]) / n_iter)
        return [result], [stats], [retvals]
    else:
        p = multiprocess.Pool(n_chains)
        seeds = torch.randint(0, 2**16-1, (n_chains,)).tolist()
        payloads = [HMCPayload(seeds[chain], n_iter, chain, L, eps, unconstrained, model, args, kwargs) for chain in range(n_chains)]
        with p:
            pmap_result = p.map(exec_hmc_payload, payloads)
            results = [r[0] for r in pmap_result]
            stats = [r[1] for r in pmap_result]
            retvals = [r[2] for r in pmap_result]
            for chain in range(n_chains):
                print(f"HMC-Chain-{chain} acceptance ratio:", sum(stat["accepted"] for stat in stats[chain]) / n_iter)
            return results, stats, retvals
