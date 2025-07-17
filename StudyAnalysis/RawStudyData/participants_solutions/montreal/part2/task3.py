#%%
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
import pymcdebug as pmd

#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

# True parameter values
alpha, sigma = 1, 1
beta = [1, 2.5]

# Size of dataset
size = 100

# Predictor variable
y = np.array([28., 8., -3., 7., -1., 1., 18., 12.])
sigma = np.array([15., 10., 16., 11., 9., 11., 10., 18.])


#### Task
# %%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with pm.Model() as eight_schools:
    # Priors for unknown model parameters
    mu = pm.Normal("mu", mu=3, sigma=5)
    tau = pm.HalfCauchy("tau", beta=5)
    theta_raw = pm.Normal("theta_raw", mu=mu, sigma=tau**2, shape=(8,))
    theta = pm.Deterministic("theta", mu + tau**2 * theta_raw)

    # Likelihood (sampling distribution) of observations
    Y_obs = pm.Normal("y", mu=theta, sigma=sigma, observed=y)

model = eight_schools

# %%

with model:
    step = pm.HamiltonianMC(step_scale=0.2, target_accept=0.8)
    idata = pmd.debug(3000, tune=1000,  chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_schools.nc")
# %%
# pm.model_to_graphviz(eight_schools)

# %%
