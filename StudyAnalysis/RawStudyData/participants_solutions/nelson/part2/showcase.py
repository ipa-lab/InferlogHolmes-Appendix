#%%
import numpy as np
import pandas as pd
import pymc as pm
import pymcdebug as pmd

#%%
RANDOM_SEED = 8927
rng = np.random.default_rng(RANDOM_SEED)

# True parameter values
alpha, sigma = 1, 1
beta = [1, 2.5]

# Size of dataset
size = 10

# Predictor variable
X1 = np.random.randn(size)
X2 = np.random.randn(size) * 0.2

# Simulate outcome variable
Y = alpha + beta[0] * X1 + beta[1] * X2 + rng.normal(size=size) * sigma

# %%
with pm.Model() as linear_regression:
    # Priors for unknown model parameters
    alpha = pm.HalfNormal("alpha", mu=0, sigma=10)
    beta = pm.Normal("beta", mu=0, sigma=10, shape=2)
    sigma = pm.HalfNormal("sigma", sigma=1)

    # Expected value of outcome
    mu = alpha + beta[0] * X1 + beta[1] * X2

    # Likelihood (sampling distribution) of observations
    Y_obs = pm.Normal("Y_obs", mu=mu, sigma=sigma, observed=Y)

model = linear_regression

with model:
    step = pm.HamiltonianMC(step_scale=0.05)
    idata = pmd.debug(1000, tune=0, init=None, step=step, chains=4, random_seed=rng)
# %%
