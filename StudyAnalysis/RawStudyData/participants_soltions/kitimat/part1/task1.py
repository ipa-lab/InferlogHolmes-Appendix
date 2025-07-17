#%% 
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
import matplotlib.pyplot as plt

#%%
x = np.array([-1., -0.5, 0.0, 0.5, 1.0])
y = np.array([-3.2, -1.8, -0.5, -0.2, 1.5])
plt.plot(x,y,'.')

#%%
with pm.Model() as linear_regression:
    slope = pm.Normal("slope", mu=0., sigma=3.)
    intercept = pm.Normal("intercept", mu=0., sigma=3.)
    sigma = pm.InverseGamma("sigma", alpha=1., beta=1.)
    y_model=pm.Deterministic('y_model',slope * x + intercept)
    pm.Normal(f"y", y_model, sigma, observed=y)

model = linear_regression

#### TASK:
#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with model:
    step = pm.HamiltonianMC(step_scale=0.2, adapt_step_size=True)
    idata = pm.sample(3500, tune=500, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_LinReg1.nc")

#%%
idata=az.from_netcdf("/app/study/results/Task_LinReg1.nc")
# %%
az.plot_trace(idata)
# %%
az.plot_ess(idata)

# %%
az.summary(idata)
# %%
