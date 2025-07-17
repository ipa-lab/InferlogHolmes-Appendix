#%% 
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
import pymcdebug as pmd

#%%
x = np.array([-1., -0.5, 0.0, 0.5, 1.0])
y = np.array([-3.2, -1.8, -0.5, -0.2, 1.5])

with pm.Model() as linear_regression:
    slope = pm.Normal("slope", mu=0., sigma=3.)
    intercept = pm.Normal("intercept", mu=0., sigma=3.)
    sigma = pm.InverseGamma("sigma", alpha=1., beta=1.)
    out_y = pm.Deterministic("out_y", slope * x + intercept)

    pm.Normal(f"y", out_y, sigma, observed=y)

model = linear_regression

#### TASK:
#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with model:
    step = pm.HamiltonianMC(step_scale=0.25, adapt_step_size=False)
    idata = pmd.debug(3500, tune=100, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_LinReg.nc")
# %%
with model:
    pm.sample_posterior_predictive(idata, extend_inferencedata=True, random_seed=RANDOM_SEED)

idata.posterior_predictive
# %%
