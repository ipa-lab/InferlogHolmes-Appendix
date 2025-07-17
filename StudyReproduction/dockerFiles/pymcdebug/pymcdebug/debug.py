#   Copyright 2024 - present The PyMC Developers
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

"""Functions for MCMC sampling."""

import sys
import os

from collections.abc import Sequence
from typing import (
    Any,
    Literal,
    overload,
)

from arviz import InferenceData
from rich.theme import Theme

import pymc as pm

from pymc.backends import TraceOrBackend
from pymc.backends.base import MultiTrace
from pymc.initial_point import StartDict
from pymc.model import Model
from pymc.util import (
    RandomState,
    default_progress_theme,
)

from pymcdebug.debugger_backend import DebuggerBackend
import requests


@overload
def debug(
    draws: int = 1000,
    *,
    tune: int = 1000,
    chains: int | None = None,
    cores: int | None = None,
    random_seed: RandomState = None,
    progressbar: bool | Any = True,
    progressbar_theme: Theme | None = default_progress_theme,
    step=None,
    var_names: Sequence[str] | None = None,
    nuts_sampler: Literal["pymc", "nutpie", "numpyro", "blackjax"] = "pymc",
    initvals: StartDict | Sequence[StartDict | None] | None = None,
    init: str = "auto",
    jitter_max_retries: int = 10,
    n_init: int = 200_000,
    trace: TraceOrBackend | None = None,
    discard_tuned_samples: bool = True,
    compute_convergence_checks: bool = True,
    keep_warning_stat: bool = False,
    return_inferencedata: Literal[True] = True,
    idata_kwargs: dict[str, Any] | None = None,
    nuts_sampler_kwargs: dict[str, Any] | None = None,
    callback=None,
    mp_ctx=None,
    blas_cores: int | None | Literal["auto"] = "auto",
    compile_kwargs: dict | None = None,
    **kwargs,
) -> InferenceData: ...


@overload
def debug(
    draws: int = 1000,
    *,
    tune: int = 1000,
    chains: int | None = None,
    cores: int | None = None,
    random_seed: RandomState = None,
    progressbar: bool | Any = True,
    progressbar_theme: Theme | None = default_progress_theme,
    step=None,
    var_names: Sequence[str] | None = None,
    nuts_sampler: Literal["pymc", "nutpie", "numpyro", "blackjax"] = "pymc",
    initvals: StartDict | Sequence[StartDict | None] | None = None,
    init: str = "auto",
    jitter_max_retries: int = 10,
    n_init: int = 200_000,
    trace: TraceOrBackend | None = None,
    discard_tuned_samples: bool = True,
    compute_convergence_checks: bool = True,
    keep_warning_stat: bool = False,
    return_inferencedata: Literal[False],
    idata_kwargs: dict[str, Any] | None = None,
    nuts_sampler_kwargs: dict[str, Any] | None = None,
    callback=None,
    mp_ctx=None,
    model: Model | None = None,
    blas_cores: int | None | Literal["auto"] = "auto",
    compile_kwargs: dict | None = None,
    **kwargs,
) -> MultiTrace: ...


def debug(
    draws: int = 1000,
    *,
    tune: int = 1000,
    chains: int | None = None,
    cores: int | None = None,
    random_seed: RandomState = None,
    progressbar: bool | Any = True,
    progressbar_theme: Theme | None = None,
    step=None,
    var_names: Sequence[str] | None = None,
    nuts_sampler: Literal["pymc", "nutpie", "numpyro", "blackjax"] = "pymc",
    initvals: StartDict | Sequence[StartDict | None] | None = None,
    init: str = "auto",
    jitter_max_retries: int = 10,
    n_init: int = 200_000,
    trace: TraceOrBackend | None = None,
    discard_tuned_samples: bool = True,
    compute_convergence_checks: bool = True,
    keep_warning_stat: bool = False,
    return_inferencedata: bool = True,
    idata_kwargs: dict[str, Any] | None = None,
    nuts_sampler_kwargs: dict[str, Any] | None = None,
    callback=None,
    mp_ctx=None,
    blas_cores: int | None | Literal["auto"] = "auto",
    model: Model | None = None,
    compile_kwargs: dict | None = None,
    **kwargs,
) -> InferenceData | MultiTrace: # | ZarrTrace:
    r"""Draw samples from the posterior using the given step methods.

    Multiple step methods are supported via compound step methods.

    Parameters
    ----------
    draws : int
        The number of samples to draw. Defaults to 1000. The number of tuned samples are discarded
        by default. See ``discard_tuned_samples``.
    tune : int
        Number of iterations to tune, defaults to 1000. Samplers adjust the step sizes, scalings or
        similar during tuning. Tuning samples will be drawn in addition to the number specified in
        the ``draws`` argument, and will be discarded unless ``discard_tuned_samples`` is set to
        False.
    chains : int
        The number of chains to sample. Running independent chains is important for some
        convergence statistics and can also reveal multiple modes in the posterior. If ``None``,
        then set to either ``cores`` or 2, whichever is larger.
    cores : int
        The number of chains to run in parallel. If ``None``, set to the number of CPUs in the
        system, but at most 4.
    random_seed : int, array-like of int, or Generator, optional
        Random seed(s) used by the sampling steps. Each step will create its own
        :py:class:`~numpy.random.Generator` object to make its random draws in a way that is
        indepedent from all other steppers and all other chains.
        A ``TypeError`` will be raised if a legacy :py:class:`~numpy.random.RandomState` object is passed.
        We no longer support ``RandomState`` objects because their seeding mechanism does not allow
        easy spawning of new independent random streams that are needed by the step methods.
    progressbar: bool or ProgressType, optional
            How and whether to display the progress bar. If False, no progress bar is displayed. Otherwise, you can ask
            for one of the following:
            - "combined": A single progress bar that displays the total progress across all chains. Only timing
                information is shown.
            - "split": A separate progress bar for each chain. Only timing information is shown.
            - "combined+stats" or "stats+combined": A single progress bar displaying the total progress across all
                chains. Aggregate sample statistics are also displayed.
            - "split+stats" or "stats+split": A separate progress bar for each chain. Sample statistics for each chain
                are also displayed.

            If True, the default is "split+stats" is used.
    step : function or iterable of functions
        A step function or collection of functions. If there are variables without step methods,
        step methods for those variables will be assigned automatically. By default the NUTS step
        method will be used, if appropriate to the model.
    var_names : list of str, optional
        Names of variables to be stored in the trace. Defaults to all free variables and deterministics.
    nuts_sampler : str
        Which NUTS implementation to run. One of ["pymc", "nutpie", "blackjax", "numpyro"].
        This requires the chosen sampler to be installed.
        All samplers, except "pymc", require the full model to be continuous.
    blas_cores: int or "auto" or None, default = "auto"
        The total number of threads blas and openmp functions should use during sampling.
        Setting it to "auto" will ensure that the total number of active blas threads is the
        same as the `cores` argument. If set to an integer, the sampler will try to use that total
        number of blas threads. If `blas_cores` is not divisible by `cores`, it might get rounded
        down. If set to None, this will keep the default behavior of whatever blas implementation
        is used at runtime.
    initvals : optional, dict, array of dict
        Dict or list of dicts with initial value strategies to use instead of the defaults from
        `Model.initial_values`. The keys should be names of transformed random variables.
        Initialization methods for NUTS (see ``init`` keyword) can overwrite the default.
    init : str
        Initialization method to use for auto-assigned NUTS samplers. See `pm.init_nuts` for a list
        of all options. This argument is ignored when manually passing the NUTS step method.
        Only applicable to the pymc nuts sampler.
    jitter_max_retries : int
        Maximum number of repeated attempts (per chain) at creating an initial matrix with uniform
        jitter that yields a finite probability. This applies to ``jitter+adapt_diag`` and
        ``jitter+adapt_full`` init methods.
    n_init : int
        Number of iterations of initializer. Only works for 'ADVI' init methods.
    trace : backend, optional
        A backend instance or None.
        If ``None``, a ``MultiTrace`` object with underlying ``NDArray`` trace objects
        is used. If ``trace`` is a :class:`~pymc.backends.zarr.ZarrTrace` instance,
        the drawn samples will be written onto the desired storage while sampling is
        on-going. This means sampling runs that, for whatever reason, die in the middle
        of their execution will write the partial results onto the storage. If the
        storage persist on disk, these results should be available even after a server
        crash. See :class:`~pymc.backends.zarr.ZarrTrace` for more information.
    discard_tuned_samples : bool
        Whether to discard posterior samples of the tune interval.
    compute_convergence_checks : bool, default=True
        Whether to compute sampler statistics like Gelman-Rubin and ``effective_n``.
    keep_warning_stat : bool
        If ``True`` the "warning" stat emitted by, for example, HMC samplers will be kept
        in the returned ``idata.sample_stats`` group.
        This leads to the ``idata`` not supporting ``.to_netcdf()`` or ``.to_zarr()`` and
        should only be set to ``True`` if you intend to use the "warning" objects right away.
        Defaults to ``False`` such that ``pm.drop_warning_stat`` is applied automatically,
        making the ``InferenceData`` compatible with saving.
    return_inferencedata : bool
        Whether to return the trace as an :class:`arviz:arviz.InferenceData` (True) object or a
        `MultiTrace` (False). Defaults to `True`.
    idata_kwargs : dict, optional
        Keyword arguments for :func:`pymc.to_inference_data`
    nuts_sampler_kwargs : dict, optional
        Keyword arguments for the sampling library that implements nuts.
        Only used when an external sampler is specified via the `nuts_sampler` kwarg.
    callback : function, default=None
        A function which gets called for every sample from the trace of a chain. The function is
        called with the trace and the current draw and will contain all samples for a single trace.
        the ``draw.chain`` argument can be used to determine which of the active chains the sample
        is drawn from.
        Sampling can be interrupted by throwing a ``KeyboardInterrupt`` in the callback.
    mp_ctx : multiprocessing.context.BaseContent
        A multiprocessing context for parallel sampling.
        See multiprocessing documentation for details.
    model : Model (optional if in ``with`` context)
        Model to sample from. The model needs to have free random variables.
    compile_kwargs: dict, optional
        Dictionary with keyword argument to pass to the functions compiled by the step methods.


    Returns
    -------
    trace : pymc.backends.base.MultiTrace | pymc.backends.zarr.ZarrTrace | arviz.InferenceData
        A ``MultiTrace``, :class:`~arviz.InferenceData` or
        :class:`~pymc.backends.zarr.ZarrTrace` object that contains the samples. A
        ``ZarrTrace`` is only returned if the supplied ``trace`` argument is a
        ``ZarrTrace`` instance. Refer to :class:`~pymc.backends.zarr.ZarrTrace` for
        the benefits this backend provides.

    Notes
    -----
    Optional keyword arguments can be passed to ``sample`` to be delivered to the
    ``step_method``\ s used during sampling.

    For example:

       1. ``target_accept`` to NUTS: nuts={'target_accept':0.9}
       2. ``transit_p`` to BinaryGibbsMetropolis: binary_gibbs_metropolis={'transit_p':.7}

    Note that available step names are:

    ``nuts``, ``hmc``, ``metropolis``, ``binary_metropolis``,
    ``binary_gibbs_metropolis``, ``categorical_gibbs_metropolis``,
    ``DEMetropolis``, ``DEMetropolisZ``, ``slice``

    The NUTS step method has several options including:

        * target_accept : float in [0, 1]. The step size is tuned such that we
          approximate this acceptance rate. Higher values like 0.9 or 0.95 often
          work better for problematic posteriors. This argument can be passed directly to sample.
        * max_treedepth : The maximum depth of the trajectory tree
        * step_scale : float, default 0.25
          The initial guess for the step size scaled down by :math:`1/n**(1/4)`,
          where n is the dimensionality of the parameter space

    Alternatively, if you manually declare the ``step_method``\ s, within the ``step``
       kwarg, then you can address the ``step_method`` kwargs directly.
       e.g. for a CompoundStep comprising NUTS and BinaryGibbsMetropolis,
       you could send ::

        step = [
            pm.NUTS([freeRV1, freeRV2], target_accept=0.9),
            pm.BinaryGibbsMetropolis([freeRV3], transit_p=0.7),
        ]

    You can find a full list of arguments in the docstring of the step methods.

    Examples
    --------
    .. code:: ipython

        In [1]: import pymc as pm
           ...: n = 100
           ...: h = 61
           ...: alpha = 2
           ...: beta = 2

        In [2]: with pm.Model() as model: # context management
           ...:     p = pm.Beta("p", alpha=alpha, beta=beta)
           ...:     y = pm.Binomial("y", n=n, p=p, observed=h)
           ...:     idata = pm.sample()

        In [3]: az.summary(idata, kind="stats")

        Out[3]:
            mean     sd  hdi_3%  hdi_97%
        p  0.609  0.047   0.528    0.699
    """

    alg = {}

    if isinstance(step, list):
        alg = [{
            "method": "metropolis_hastings" if s.name == "metropolis" else "hmc",
            "params": {
                "blockUpdates": s.blocked if hasattr(s, 'blocked') else False,
                "varNames": [v.name for v in s.vars] if hasattr(s, 'vars') else None,
            } if s.name == "metropolis" else {
                "L": s.max_steps,
                "epsilon": s.step_size if 'step_size' in s.__dict__ else 0.1,
                "varNames": [v.name for v in s.vars] if hasattr(s, 'vars') else None,
            }
        } for s in step]
    elif step == None:
        alg = {
            "method": "nuts",
            "params": {
                "target_accept": 0.9,
                "max_treedepth": 10,
                "step_size": 0.25
            }
        }
    elif step.name == "nuts":
        alg = {
            "method": "nuts",
            "params": {
                "target_accept": step.target_accept,
                "max_treedepth": step.max_treedepth,
                "step_size": step.step_size,
            }
        }
    elif step.name == "hmc":
        alg = {
            "method": "hmc",
            "params": {
                "L": step.max_steps,
                "epsilon": step.step_size,
            }
        }
    elif step.name == "metropolis" or step.name.startswith("Compound"):
        alg = {
            "method": "metropolis_hastings",
            "params": {
                "blockUpdates": step.blocked if hasattr(step, 'blocked') else True,
            }
        }
    else:
       alg = {
            "method": "hmc",
            "params": {
                "L": 10,
                "epsilon": step.step_size if 'step_size' in step.__dict__ else 0.1,
            }
        }
       
    file_path = os.path.abspath(sys.modules['__main__'].__file__)

    js = {
        "ppl": "pymc",
        "filePath": file_path,
        "alg": alg,
        "totalIteration": draws + tune,
	    "burnin": tune,
	    "chains": chains
    }

    requests.post('http://localhost:8484/start', json=js)
    
    return pm.sample(
        draws=draws,
        tune=tune,
        chains=chains,
        cores=cores,
        random_seed=random_seed,
        progressbar=progressbar,
        progressbar_theme=progressbar_theme,
        step=step,
        var_names=var_names,
        nuts_sampler=nuts_sampler,
        initvals=initvals,
        init=init,
        jitter_max_retries=jitter_max_retries,
        n_init=n_init,
        trace=DebuggerBackend(),
        discard_tuned_samples=discard_tuned_samples,
        compute_convergence_checks=compute_convergence_checks,
        keep_warning_stat=keep_warning_stat,
        return_inferencedata=return_inferencedata,
        idata_kwargs=idata_kwargs,
        nuts_sampler_kwargs=nuts_sampler_kwargs,
        callback=callback,
        mp_ctx=mp_ctx,
        blas_cores=blas_cores,
        compile_kwargs=compile_kwargs,
        **kwargs,
    )