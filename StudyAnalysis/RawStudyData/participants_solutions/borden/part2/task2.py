#%% 
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
import pymcdebug as pmd

#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

x = np.array([-1., -0.5, 0.0, 0.5, 1.0])
y = np.array([-3.2, -1.8, -0.5, -0.2, 1.5])

with pm.Model() as linear_regression:
    slope = pm.Normal("slope", mu=0., sigma=3.)
    intercept = pm.Normal("intercept", mu=0., sigma=3.)
    sigma = pm.InverseGamma("sigma", alpha=1., beta=1.)

    pm.Normal(f"y", mu=slope * x + intercept, sigma=sigma, observed=y)

model = linear_regression

#### TASK:
#%%

with model:
    step = pm.HamiltonianMC(step_scale=0.25, adapt_step_size=True)
    idata = pmd.debug(3500, tune=100, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_LinReg.nc")