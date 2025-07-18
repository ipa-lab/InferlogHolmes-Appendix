# InferlogHolmes-Appendix

This is the Online Appendix to: **Online and Interactive Bayesian Inference Debugging**. It contains:
- raw and cleaned data from the study, 
- code used for the data analysis in Jupyter Notebooks
- additional graphs and statistical tests and checks inside Jupyter Notebooks
- Dockerfiles and instructions on how to reproduce the study environment
- Source code for InferLog Holmes and instructions on how to build it.
- Source code for the tool used to log the participants task attempts.

## Overview:
```
📦 .
├─ InferLogHolmes/										              # InferLog Holmes Source Code
│  ├─ extension/										                # Source Code to the VsCode Extension
│  ├─ ppl/												                  # Source Code to custom inhouse PPL
│  ├─ pymcdebug/										                # Source Code to python package for debugging PyMC
│  ├─ static/											                  # Source Code to slightly altered LASAPP
│  ├─ test/												                  # a workspace test folder for the extension
|. └─ readme.md											                # instructions on how to build InferLog Holmes from scratch
├─ StudyAnalysis/										                # Study Analysis for the paper
│  ├─ RawStudyData/										              # Data collected from the study
│  │  ├─ participants_solutions/						        # Solutions to tasks for each participant
│  │  ├─ timestamps/									              # Logged and cleaned Timestamps for participants task attempts
│  │  ├─ all_combined.csv								            # Final combined summary statistics to participants attempts
│  │  └─ Inference Analysis Post-Study Survey.csv		# Post-Study Survey responses
│  ├─ table_results										              # Automatically generated latex tables
│  ├─ bayesian_data_analysis.ipynb						      # Bayesian Analysis for RQ1 - Hypothesis1
│  ├─ readme.md											                # Instructions on how to run the notebooks
│  ├─ study_data_analysis.ipynb							        # Data Analysis, tests and plots for RQ1, RQ2 and RQ3
│  └─ utils.py											                # utility functions for plotting and statistical tests
├─ StudyLogger/											                # Source Code to the tool used to log participants attempts
├─ StudyReproduction/									              # Full Study Environment reproduction scripts
│  ├─ dockerFiles										                # Files to built the docker image with prebuilt vscode and InferLog Holmes
│  ├─ FullStudyAndTasksFolder							          # Prepared task templates
│  └─ readme.md											                # Instructions on how to reproduce the study environment and test InferLog Holmes
└─ README.md                                        # This file
```

## Run InferLog Holmes

Follow the instructions in [StudyReproduction/readme.md](StudyReproduction/readme.md) to setup the docker image used in the study and test the application in a reproducible environment. Alternatively follow [InferLogHolmes/readme.md](InferLogHolmes/readme.md) to build and run InferLog Holmes from scratch.

## Study Analysis
### Main Analysis
We have prepared two notebooks for the analysis presented in our study. The main analysis is conducted here: [StudyAnalysis/study_data_analysis.ipynb](StudyAnalysis/study_data_analysis.ipynb). In this notebook you will find all the quantitative tests, we've conducted for this study, as well as plots that summarize data for both the quantitaive and the qualitative analysis. In this notebook you'll also find some plots that did not make it to the paper due to space limitiations.

### Bayesian Analysis
The Bayesian analysis conducted for RQ1 - H1 can be found here: [StudyAnalysis/bayesian_data_analysis.ipynb](StudyAnalysis/bayesian_data_analysis.ipynb). This notebook contains the full model together with plots, posterior checks and posterior predictive samples from a secondary prediction model.

