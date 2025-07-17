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
    mu = pm.Normal("mu", mu=0, sigma=5)
    # tau = pm.HalfCauchy("tau", beta=5)
    tau = pm.Normal("tau", mu=0, sigma=5)
    # theta = pm.Normal("theta", mu=mu, sigma=tau**2, shape=(8,))
    theta_raw = pm.Normal("theta_raw", mu=0, sigma=1, shape=(8,))
    scale = tau**2
    # scale = tau
    theta = pm.Deterministic("theta", mu + scale * theta_raw)

    # Likelihood (sampling distribution) of observations
    Y_obs = pm.Normal("y", mu=theta, sigma=sigma, observed=y)

model = eight_schools

#%%
with model:
    step = pm.HamiltonianMC(step_scale=0.33, target_accept=0.65)
    idata = pmd.debug(3000, tune=500, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_schools.nc")

raise SystemExit

#%%
idata = az.from_netcdf("/app/study/results/Task_schools.nc")
#%%
with model:
    pm.sample_posterior_predictive(idata, extend_inferencedata=True, random_seed=rng)
# %%
az.plot_ppc(idata, num_pp_samples=100)
# %%
with model:
    idata_prior = pm.sample_prior_predictive(draws=50, random_seed=rng)

# %%
idata_prior
# %%
az.plot_trace(idata_prior, var_names=["y"])
# %%
import matplotlib.pyplot as plt

# %%
plt.hist(idata_prior.prior_predictive['y'].values.reshape(-1, 8).flatten())
# %%
idata_prior
# %%

plt.hist(idata_prior.prior['theta'].values.flatten())
# %%
pm.HalfCauchy
# %%
