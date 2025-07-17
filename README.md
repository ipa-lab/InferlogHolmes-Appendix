# InferlogHolmes-Appendix

## Overview:
```
📦 .
├─ InferLogHolmes/										# InferLog Holmes Source Code
│  ├─ extension/										# Source Code to the VsCode Extension
│  ├─ ppl/												# Source Code to custom inhouse PPL
│  ├─ pymcdebug/										# Source Code to python package for debugging PyMC
│  ├─ static/											# Source Code to slightly altered LASAPP
│  └─ test/												# a workspace test folder for the extension
├─ StudyAnalysis/										# Study Analysis for the paper
│  ├─ RawStudyData/										# Data collected from the study
│  │  ├─ participants_solutions/						# Solutions to tasks for each participant
│  │  ├─ timestamps/									# Logged and cleaned Timestamps for participants task attempts
│  │  ├─ all_combined.csv								# Final combined summary statistics to participants attempts
│  │  └─ Inference Analysis Post-Study Survey.csv		# Post-Study Survey responses
│  ├─ table_results										# Automatically generated latex tables
│  ├─ bayesian_data_analysis.ipynb						# Bayesian Analysis for RQ1 - Hypothesis1
│  ├─ readme.md											# Instructions on how to run the notebooks
│  ├─ study_data_analysis.ipynb							# Data Analysis, tests and plots for RQ1, RQ2 and RQ3
│  └─ utils.py											# utility functions for plotting and statistical tests
├─ StudyLogger/											# Source Code to the tool used to log participants attempts
├─ StudyReproduction/									# Full Study Environment reproduction scripts
│  ├─ dockerFiles										# Files to built the docker image with prebuilt vscode and InferLog Holmes
│  ├─ FullStudyAndTasksFolder							# Prepared task templates
│  └─ readme.md											# Instructions on how to reproduce the study environment and test InferLog Holmes
└─ README.md
```

## Run InferLog Holmes

Follow the instructions in [StudyReproduction/readme.md](StudyReproduction/readme.md) to setup the docker image used in the study and test the application in a reproducible environment.

