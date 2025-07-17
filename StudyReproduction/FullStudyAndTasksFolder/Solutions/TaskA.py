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

    pm.Normal(f"y", slope * x + intercept, sigma, observed=y)

model = linear_regression

# Problems:
# 1. The step_scale is too large

# Solution Steps:
# 1. We see stuck chains over a long period of time. Also Acceptance Rate is suspiciously low.
# 2. We reduce the step_scale to 0.25 or set adapt_step_size=True
# 3. We are done


#### TASK:
#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with model:
    step = pm.HamiltonianMC(step_scale=0.25, adapt_step_size=False)
    idata = pmd.debug(3500, tune=500, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/TaskA.nc")