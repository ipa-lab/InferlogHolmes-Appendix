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


# Problems:
# 1. The model has variables that are centered and produce a funnel.
# 2. Burnin present: the tune and total sample size are too small
# 3. (Optional) Depending on Burnin configuration, pymc autotuning overshoots

# Solution Steps:
# 1. We realize that the acceptance rate is very high and the ESS is very low
# 2. This makes us suspicious!
# 3. We reparameterize our model
# 4. We see that our model is not burnin free.
# 5a. We raise tune to ~500
#   If we don't care about divergencies: We are done.
# 5b. We raise tune > 500
# 6b. We realize that PYMC autotuning overshoots
# 7b. We change target_accept to >= 0.8 or set adapt_step_size=False
# 8b. We are done.

# %%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with pm.Model() as eight_schools:
    # Priors for unknown model parameters
    mu = pm.Normal("mu", mu=0, sigma=5)
    tau = pm.HalfCauchy("tau", beta=5)
    theta_raw = pm.Normal("theta_raw", mu=0, sigma=1, shape=(8,))
    theta = pm.Deterministic("theta", mu + tau**2 * theta_raw)

    # Likelihood (sampling distribution) of observations
    Y_obs = pm.Normal("y", mu=theta, sigma=sigma, observed=y)

model = eight_schools

with model:
    step = pm.HamiltonianMC(step_scale=0.33, target_accept=0.93)
    idata = pmd.debug(3000, tune=1000, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/TaskC.nc")
