from .core import SampleContext
from collections import namedtuple
from abc import ABC, abstractmethod
import torch
import torch.distributions as dist
from typing import Optional, NewType, Union, Callable, List, Dict
from tqdm import tqdm
import requests
import simplejson as json

class ProposalDistribution(ABC):
    @abstractmethod
    def propose(self, x_current: torch.Tensor) -> torch.Tensor:
        # samples according to x' ~ Q(x'|x)
        raise NotImplementedError
    @abstractmethod
    def proposal_log_prob(self, proposal: torch.Tensor, x_current: torch.Tensor)  -> torch.Tensor:
        # computes probability log Q(x'|x)
        raise NotImplementedError
    
class UnconditionalProposal(ProposalDistribution):
    def __init__(self, distribution: dist.Distribution) -> None:
        self.distribution = distribution
    def propose(self, x_current: torch.Tensor) -> torch.Tensor:
        return self.distribution.sample() # propsal is independent of x_current
    def proposal_log_prob(self, proposal: torch.Tensor, x_current: torch.Tensor) -> torch.Tensor:
        return self.distribution.log_prob(proposal)
    
class RandomWalkProposal(ProposalDistribution):
    def __init__(self, std: float) -> None:
        self.std = std

    def propose(self, x_current: torch.Tensor) -> torch.Tensor:
        proposal_dist = dist.Normal(x_current, self.std)
        return proposal_dist.sample()
    
    def proposal_log_prob(self, proposal: torch.Tensor, x_current: torch.Tensor)  -> torch.Tensor:
        return dist.Normal(x_current, self.std).log_prob(proposal)


TraceEntry = namedtuple("TraceEntry", ["value", "log_prob"])

ProposalDict = NewType('ProposalDict', Dict[str, Union[ProposalDistribution, Callable[[torch.Tensor], dist.Distribution]]])

class LMH(SampleContext):
    def __init__(self, proposals: ProposalDict = {}) -> None:
        super().__init__()
        self.proposals = proposals
        self.trace_current = {}
        self.resample_addresses = {}
        
        self.log_prob = torch.tensor(0.0)
        self.trace_proposed = {}
        self.Q_resample_address = torch.tensor(0.0)

    def sample(self, address: str, distribution: dist.Distribution, observed: Optional[torch.Tensor] = None):
        if observed is not None:
            self.log_prob += distribution.log_prob(observed).sum()
            return observed

        if address in self.resample_addresses:
            current_value = self.trace_current[address].value
            proposal = self.proposals.get(address, UnconditionalProposal(distribution))
            if isinstance(proposal, ProposalDistribution):
                proposal_dist = proposal
                value = proposal_dist.propose(current_value)
                proposal_log_prob = proposal_dist.proposal_log_prob(value, current_value)
                backward_log_prob = proposal_dist.proposal_log_prob(current_value, value)
            else: # is Callable
                proposal_dist_forward = proposal(current_value)
                value = proposal_dist_forward.sample()
                proposal_log_prob = proposal_dist_forward.log_prob(value)
                proposal_dist_backward = proposal(value)
                backward_log_prob = proposal_dist_backward.log_prob(current_value)

            self.Q_resample_address += backward_log_prob - proposal_log_prob

            
        elif address not in self.trace_current:
            value = distribution.sample()
            
        else:
            # reuse value from trace_current
            value = self.trace_current[address].value
        
        log_prob = distribution.log_prob(value)
        self.log_prob += log_prob
        
        # store sampled value and log probability
        self.trace_proposed[address] = TraceEntry(value, log_prob)

        return value


def metropolis_hastings_worker(n_iter: int, chain: int, proposals: Union[ProposalDict, List[ProposalDict]], model, *args, **kwargs):
    result = []
    stats = []
    retvals = []
    ctx = LMH()

    do_block_updates = isinstance(proposals, List)

    # Initialise
    with ctx:
        retval_current    = model(*args, **kwargs)
        trace_current     = ctx.trace_proposed
        log_prob_current  = ctx.log_prob
        addresses_current = list(trace_current.keys())

    n_accept = 0

    for i in tqdm(range(n_iter), desc=f"LMH-Chain-{chain}", position=chain):
        # Reset
        ctx.log_prob = torch.tensor(0.)
        ctx.Q_resample_address = torch.tensor(0.0)
        ctx.trace_current = trace_current
        ctx.trace_proposed = {}
        
        if do_block_updates:
            # Pick random block
            block_proposals = proposals[torch.randint(len(proposals), ())]
            ctx.proposals = block_proposals
            ctx.resample_addresses = block_proposals.keys()
        else:
            # Pick a random address to resample
            ctx.proposals = proposals
            ctx.resample_addresses = {addresses_current[torch.randint(len(addresses_current), ())]}
        
        # Run model
        # - reuse current trace if possible
        # - resample at resample_address
        # - sample at new addresses
        try:
            with ctx:
                retval_proposed    = model(*args, **kwargs)
                log_prob_proposed  = ctx.log_prob
                trace_proposed     = ctx.trace_proposed
                addresses_proposed = list(trace_proposed.keys())

            # Compute acceptance probability
            log_alpha = torch.log(torch.tensor(len(trace_current) / len(trace_proposed)))
            log_alpha += log_prob_proposed - log_prob_current
            log_alpha += ctx.Q_resample_address

            for address, entry in trace_current.items():
                if address not in trace_proposed:
                    log_alpha += entry.log_prob
            for address, entry in trace_proposed.items():
                if address not in trace_current:
                    log_alpha -= entry.log_prob

            # Accept with probability alpha
            accepted = False
            if dist.Uniform(0.,1.).sample().log() < log_alpha:
                n_accept += 1
                accepted = True
                retval_current    = retval_proposed
                trace_current     = trace_proposed
                addresses_current = addresses_proposed
                log_prob_current  = log_prob_proposed
            diverged = log_prob_proposed.isnan().item() or log_prob_proposed.isinf().item()

        except ValueError:
            # stepped out of bounds of support (invalid args)
            log_prob_proposed = torch.tensor(-torch.inf)
            trace_proposed = {}
            accepted = False
            diverged = True
            

        stat = {
            "iter": i,
            "chain": chain,
            "trace_current": {k: v.value for k, v in trace_current.items()},
            "log_prob_current": log_prob_current,
            "trace_proposed": {k: v.value for k, v in trace_proposed.items()},
            "log_prob_proposed": log_prob_proposed,
            "accepted": accepted,
            "diverged": diverged,
            "resample_addresses": ctx.resample_addresses
        }
        stats.append(stat)
        # print()
        # print()
        # print(stat)
        # print()
        # print()
        
        jsonStat = {
            "iter": i,
            "chain": chain,
            "trace_current": {k: v.item() for k, v in stat["trace_current"].items()},
            "log_prob_current": stat["log_prob_current"].item(),
            "trace_proposed": {k: v.item() for k, v in stat["trace_proposed"].items()},
            "log_prob_proposed": stat["log_prob_proposed"].item(),
            "accepted": accepted,
            "diverged": diverged,
            "resample_addresses": list(ctx.resample_addresses)
        }
        # TODO: make API call here
        requests.post('http://localhost:8484/trace', data=json.dumps(jsonStat, ignore_nan=True))

        # Store regardless of acceptance
        result.append(trace_current)
        retvals.append(retval_current)

    # print(f"Acceptance ratio: {n_accept/n_iter:.4f}")
    return result, stats, retvals


import multiprocess
# for MACOS: set OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
# https://stackoverflow.com/questions/50168647/multiprocessing-causes-python-to-crash-and-gives-an-error-may-have-been-in-progr

# from multiprocessing import Pool

class MetropolisHastingsPayload(object):
    def __init__(self, seed: int,  n_iter: int, chain: int, proposals: Union[ProposalDict, List[ProposalDict]], model, args, kwargs) -> None:
        self.n_iter = n_iter
        self.seed = seed
        self.chain = chain
        self.proposals = proposals
        self.model = model
        self.args = args
        self.kwargs = kwargs

def exec_metropolis_hastings_payload(payload: MetropolisHastingsPayload):
    torch.manual_seed(payload.seed)
    return metropolis_hastings_worker(payload.n_iter, payload.chain, payload.proposals, payload.model, *payload.args, **payload.kwargs)

def metropolis_hastings(n_iter: int, n_chains: int, proposals: Union[ProposalDict, List[ProposalDict]], model, *args, **kwargs):
    assert n_chains > 0

    do_block_updates = isinstance(proposals, List)

    requests.post('http://localhost:8484/start', json={
        "method": "metropolis_hastings",
        "params": {
            "totalIteration": n_iter,
            "chains": n_chains,
            "blockUpdates": do_block_updates
        }
    })

    if n_chains == 1:
        result, stats, retvals = metropolis_hastings_worker(n_iter, 0, proposals, model, *args, **kwargs)
        print(f"LMH acceptance ratio:", sum(stat["accepted"] for stat in stats[0]) / n_iter)
        return [result], [stats], [retvals]
    else:
        p = multiprocess.Pool(n_chains)
        seeds = torch.randint(0, 2**16-1, (n_chains,)).tolist()
        payloads = [MetropolisHastingsPayload(seeds[chain], n_iter, chain, proposals, model, args, kwargs) for chain in range(n_chains)]
        with p:
            pmap_result = p.map(exec_metropolis_hastings_payload, payloads)
            results = [r[0] for r in pmap_result]
            stats = [r[1] for r in pmap_result]
            retvals = [r[2] for r in pmap_result]
            for chain in range(n_chains):
                print(f"LMH-Chain-{chain} acceptance ratio:", sum(stat["accepted"] for stat in stats[chain]) / n_iter)
            return results, stats, retvals
