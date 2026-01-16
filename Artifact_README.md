# Online and Interactive Bayesian Inference Debugging

## Purpose
The artifact provided with this paper, InferLog Holmes, is a debugging tool designed to assist developers in identifying and resolving inference issues in probabilistic programs. The artifact package serves three primary purposes: (1) it provides the complete source code and a containerized environment (Docker) to run the tool, allowing researchers to inspect and reuse the debugger on their own probabilistic models; and (2) it includes the files and tools used in the user study for other researchers to reproduce the study; and (3) it includes the complete raw dataset and analysis scripts from the user study reported in the paper, enabling the automated reproduction of the statistical results and figures.

We are applying for the following badges:
- **Artifact Available**: This artifact is publicly accessible via a permanent, archival repository on Zenodo with a Digital Object Identifier (DOI) (https://doi.org/10.5281/zenodo.18262423). It is also available under an open-source license on GitHub (https://github.com/ipa-lab/InferlogHolmes-Appendix), ensuring barrier free availability for the community.
- **Artifact Reusable**: We believe this artifact meets the criteria for reusability because:

    - Ease of Use: The main tool is packaged as a Docker container (the exact same that was used during the study) and is accessible through a standard web browser, eliminating installation and dependency issues.

    - Reproducibility: It includes the full study data (raw and processed) and detailed Jupyter Notebooks that automatically process the study data and regenerate the paper’s statistical claims and plots. Furthermore we include all tasks configuration and the custom logging tool used for logging a participants attempt.

    - Modularity: The tool is structured to allow users to define and debug their own new probabilistic models beyond the examples provided in the package. The tool can further  be extended to support other probabilistic programming languages and inference algorithms.

## Provenance
The artifact is publicly accessible via a permanent, archival repository on Zenodo with a Digital Object Identifier (DOI) (https://doi.org/10.5281/zenodo.18262423).

## Data
The raw (anonymized) and processed data collected during the user study is included in the archive and made available under the Open Database License 1.0 . The data contains events collected during participants attempts of solving a Bayesian inference problem. The data can be found inside InferlogHolmes-Appendix.zip file in the folder `StudyAnalysis/RawStudyData`.

## Setup

### System Requirements

#### Main tool and Study Reproduction Requirements:
- Docker
- GitHub account
- Modern web browser with JavaScript enabled

#### Data Analysis Requirements
- VSCode, JupyterHub or other way of viewing Jupyter Notebooks
- conda

### Setup Instructions
First extract the InferlogHolmes-Appendix.zip. In it you'll find:
```
📦 .
├─ InferLogHolmes/                                  # InferLog Holmes Source Code
│  ├─ extension/                                    # Source Code to the VsCode Extension
│  ├─ ppl/                                          # Source Code to custom inhouse PPL
│  ├─ pymcdebug/                                    # Source Code to python package for debugging PyMC
│  ├─ static/                                       # Source Code to slightly altered LASAPP
│  ├─ test/                                         # a workspace test folder for the extension
|. └─ readme.md                                     # instructions on how to build InferLog Holmes from scratch
├─ StudyAnalysis/                                   # Study Analysis for the paper
│  ├─ RawStudyData/                                 # Data collected from the study
│  │  ├─ participants_solutions/                    # Solutions to tasks for each participant
│  │  ├─ timestamps/                                # Logged and cleaned Timestamps for participants task attempts
│  │  ├─ all_combined.csv                           # Final combined summary statistics to participants attempts
│  │  └─ Inference Analysis Post-Study Survey.csv   # Post-Study Survey responses
│  ├─ table_results/                                # Automatically generated latex tables
│  ├─ bayesian_data_analysis.ipynb                  # Bayesian Analysis for RQ1 - Hypothesis1
│  ├─ readme.md                                     # Instructions on how to run the notebooks
│  ├─ study_data_analysis.ipynb                     # Data Analysis, tests and plots for RQ1, RQ2 and RQ3
│  └─ utils.py                                      # utility functions for plotting and statistical tests
├─ StudyLogger/                                     # Source Code to the tool used to log participants attempts
├─ StudyReproduction/                               # Full Study Environment reproduction scripts
│  ├─ dockerFiles/                                  # Files to built the docker image with prebuilt vscode and InferLog Holmes
│  ├─ FullStudyAndTasksFolder/                      # Prepared task templates
│  └─ readme.md                                     # Instructions on how to reproduce the study environment and test InferLog Holmes
└─ README.md                                        # Provides an overview and links instructions
```

1. For running the main tool in the study environment follow the `StudyReproduction/readme.md` file from the extracted zip container.
2. For reproducing the study results follow `StudyAnalysis/readme.md` from the extracted zip container. Both Notebooks (`StudyAnalysis/study_data_analysis.ipynb` and `StudyAnalysis/bayesian_data_analysis.ipynb`) in this folder are pre executed and contain all results. 
   1. The notebook `StudyAnalysis/study_data_analysis.ipynb` contains the main quantitaive analysis and graphs from the paper ordered by paper sections. 
   2. The notebook `StudyAnalysis/bayesian_data_analysis.ipynb` contains the code and analysis for the Bayesian analysis conducted in Section 6.1 of the paper, with all convergence checks applied. The readme contains setup instructions for the environment to rerun the notebooks.
3. Other: other folders are mainly for documentation purpose and source code availability to support reporduction and reuse (InferLogHolmes contains the source code to the tool, StudyLogger contains the source code to the logging tool used during the study). Each of these folders has a readme with instructions on how to build the code from scratch.

## Usage
This is an instructional guide for the main tool of this paper: InferLog Holmes. After the setup is completed and you are connected to the server with VSCode online:
1. Press `F1` and enter: `Python: Select Interpreter` and make sure to select version `3.10`
2. If you chose to copy one of the template folders like `ABC` or `BCA` you can test InferLog Holmes on any file in the folder `part2`. `part1` will contain a file `task1.py` that by default does not work with the debugger. If you want to test this file with the debugger make sure to make the necessary adjustments mentioned in `StudyReproduction/readme.md`.
3. Open for example `task2.py` from the folder `part2`.
4. With cursor inside the file (focused editor) press `F1` and enter `PPL Debugger: Start Debugging File`
5. Make sure that the files imports `pymcdebug as pmd` and calls `pmd.debug` instead of `pm.sample` for running inference.
6. Run the file (best through the Play button or with python from the command line (e.g. `python part2/task2.py`)).
7. After a couple of seconds the debugger window should show incoming samples. The UI should be self explainatory. 
8. You can zoom and pane the model graph in the `Model` View and click on individual Nodes to get to the equivilant line of code in the file.
9. You can switch to the `Live Debugging` and see the posterior traces develop. Individual variables are selectable through buttons and the chain to observe can be choosen from a drop down.
10. Click for any variable on details to get the expanded view with even more live graphs.
11. Go back and then switch to the warnings page.
12. You can expand the warnings. Many of them will have further collapsed sub warnings which can also be expanded for more details. 
13. You can cancel inference (if it has not yet completed) and tryout following some of the warnings suggestions
14. For the intended workflow you would repeatedly start inference -> observe analytics -> improve -> start inference
15. After you are done doing that you could go to `task3.py` and run this task as well. The debugger should attach itself automatically to the new file.