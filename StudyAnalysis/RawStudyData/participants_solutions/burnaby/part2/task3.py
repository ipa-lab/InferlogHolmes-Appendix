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

    pm.Normal("y", slope * x + intercept, sigma, observed=y)

model = linear_regression

#### TASK:
#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with model:
    step = pm.HamiltonianMC(step_scale=0.25, target_accept=0.9)
    idata = pmd.debug(3500, tune=1000, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_LinReg.nc")