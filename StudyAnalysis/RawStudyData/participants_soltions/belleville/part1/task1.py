#%% 
import numpy as np
import pandas as pd
import arviz as az
import pymc as pm
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
    muc = pm.Normal("muc", mu=0., sigma=1.)

    lambdad = pm.Gamma("lambdad", alpha=1., beta=1.)
    lambdac = pm.Gamma("lambdac", alpha=1., beta=1.)
    
    dval_raw = pm.Normal("dval_raw", mu=0, sigma=1, shape=(k,))
    dval = pm.Deterministic("dval", muc + 1/lambdac**0.5 * dval_raw)

    cval_raw = pm.Normal("cval_raw", mu=0, sigma=1, shape=(k,))
    cval = pm.Deterministic("cval", muc + 1/lambdac**0.5 * cval_raw)

    thetah = Phi(dval/2 - cval)
    thetaf = Phi(-dval/2 - cval)

    pm.Binomial("h", n=s1, p=thetah, observed=h1)
    pm.Binomial("f", n=n1, p=thetaf, observed=f1)

model = heit_rotello

#%%
RANDOM_SEED = 1234
rng = np.random.default_rng(RANDOM_SEED)
with model:
    step = pm.HamiltonianMC(step_scale=0.9, max_steps=10, adapt_step_size=False)
    idata = pm.sample(1500, tune=500, step=step, chains=4, random_seed=rng)

idata.to_netcdf("/app/study/results/Task_rotello.nc")

# %%
az.summary(idata, round_to=1)
# %%
az.summary(idata, round_to=2)
# %%
az.plot_trace(idata, var_names=["mud"], combined=True)
# %%
az.plot_trace(idata, var_names=["muc"], combined=True)
# %%
az.plot_trace(idata, var_names=["lambdad"], combined=True)
# %%
az.plot_trace(idata, var_names=["lambdac"], combined=True)
# %%
az.plot_trace(idata, var_names=["dval_raw"], combined=True)
# %%
az.plot_trace(idata, var_names=["cval_raw"], combined=True)
#%%
az.plot_ess(idata, kind="evolution")
# %%
az.plot_ess(idata, kind="local")

#%%
az.plot_autocorr(idata, combined=True)