#%% 
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
import pymcdebug as pmd
import pytensor as pt

#%%
std_d = pd.read_csv("/app/study/resources/heit_rotello_std_d.csv") # deduction data
std_i = pd.read_csv("/app/study/resources/heit_rotello_std_i.csv") # induction data

h1  = np.array(std_i["V1"])
f1  = np.array(std_i["V2"])
MI1 = np.array(std_i["V3"])
CR1 = np.array(std_i["V4"])
s1 = h1 + MI1
n1 = f1 + CR1

h2  = np.array(std_d["V1"])
f2  = np.array(std_d["V2"])
MI2 = np.array(std_d["V3"])
CR2 = np.array(std_d["V4"])
s2 = h2 + MI2
n2 = f2 + CR2

k = 8
s1 = s1[:k]
n1 = n1[:k]
h1 = h1[:k]
f1 = f1[:k]

def Phi(x):
    return 0.5 + 0.5 * pt.tensor.erf(x / pt.tensor.sqrt(2))

#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)

with pm.Model() as heit_rotello:
    mud = pm.Normal("mud", mu=0., sigma=3.)
    muc = pm.Normal("muc", mu=0., sigma=3.)

    lambdad = pm.Gamma("lambdad", alpha=1., beta=1.)
    lambdac = pm.Gamma("lambdac", alpha=1., beta=1.)
    
    dval_raw = pm.Normal("dval_raw", mu=0, sigma=1, shape=(k,))
    dval = pm.Deterministic("dval", mud + 1/lambdad**0.5 * dval_raw)

    cval_raw = pm.Normal("cval_raw", mu=0, sigma=1, shape=(k,))
    cval = pm.Deterministic("cval", muc + 1/lambdac**0.5 * cval_raw)

    thetah = Phi(dval/2 - cval)
    thetaf = Phi(-dval/2 - cval)

    pm.Binomial("h", n=s1, p=thetah, observed=h1)
    pm.Binomial("f", n=n1, p=thetaf, observed=f1)

model = heit_rotello


# Problems:
# 1. There is a copy-paste/typo mistake in the model. lambdac and muc are used to calculate d_raw instead of lambdad and mud.
# 2. (optional if 1 is not solved) The step_scale is too large
# 3. Burnin present: the tune and total sample size are too small

# Solution Steps:
# 1. We see that 2 variables are not connected
# 2. This makes us suspicious!
# 3. We fix the copy-paste/typo error in the model
# 4 TODO: Is this optional??? (If we solve 1 the debugger doesn't pick up on this but we see divergencies at the end of inference):
#   1. We see that acceptance rate and ESS are low
#   2. This makes us suspicious
#   3. We lower the step_scale to 0.6
# 5. We see that our chains are not completely stationary after burnin
# 6. We raise the total samples to 2500 and the tune size to 1000


#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)
with model:
    step = pm.HamiltonianMC(step_scale=0.6, max_steps=10, adapt_step_size=False)
    idata = pmd.debug(2500, tune=1000, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/TaskB.nc")

# %%
