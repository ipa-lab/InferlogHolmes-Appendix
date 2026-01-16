# Setup the study Environment and Run InferLog Holmes

**Requires docker installed and running on your system!**

1. From the folder that contains this readme run `cd dockerFiles`.
2. Prebuilt docker images are included in the zenodo release of this artifact [10.5281/zenodo.18262423](https://doi.org/10.5281/zenodo.18262423). Depending on your system run `docker load -i arm64.tar` or `docker load -i amd64.tar`
   1. Alternatively replace `code.deb` with `code_arm64.deb` or `code_x86.deb` depending on the architecture of your system.
   2. Run `docker build -t inferlog:holmes .`
3. Copy a template folder of your choosing e.g. `cp -R ../FullStudyAndTasksFolder/ABC ../participant`
4. Run `docker run --name inferlog --env PARTICIPANT=p12 --volume {ABSOLUT_PATH_TO_PARTICIPANT_FOLDER}:/app/study inferlog:holmes`
	- `{ABSOLUT_PATH_TO_PARTICIPANT_FOLDER}` is your local absolute path to the folder we just copied the template folder to.
5. Follow the instructions in the terminal to get access to VSCode Online
   - This step requires a github account.
6. Wait 1-2 minutes after the link to `vscode.dev` appeared in your console and then follow it (should be: [https://vscode.dev/tunnel/holmes-92u3s-p12/app/study](https://vscode.dev/tunnel/holmes-92u3s-p12/app/study))
7. Follow the link and choose account type: GitHub
8.  Press `F1` and enter: `Python: Select Interpreter` and make sure to select version `3.10`
9.  Setup Finished!

## Use InferLog Holmes
- To start InferLog Holmes for any python file with a probabilistic model in it you can open the file and press `F1` and enter `PPL Debugger: Start Debugging File`.

- Make sure to import `import pymcdebug as pmd` and call `pmd.debug` instead of `pm.sample` for running inference.

- Run the file (best through the Play button or with python from the command line.)

- If you run any file that has a `pmd.debug` statement executed, the debugger will automatically attach itself to it.

- After a couple of seconds the debugger window should show incoming samples. The UI should be self explainatory. 
  - For all the prepared tasks warnings should appear. T
  - he warnings on the warnings page are expandable. 
  - The details button for variables in the Live Debugging View opens a pane with more plots and an overview of all chains.

### Test with one of the prepared Task Folders
If you chose to copy one of the template folders like `ABC` or `BCA` you can test InferLog Holmes on any file in the folder `part2`. `part1` will contain a file `task1.py` that by default does not work with the debugger. If you want to test this file with the debugger make sure to make the adjustments mentioned in the previous part.

## Step By Step walkthrough
This is an instructional guide for the main tool of this paper: InferLog Holmes. After the setup is completed and you are connected to the server with VSCode online:
1. Press `F1` and enter: `Python: Select Interpreter` and make sure to select version `3.10`
2. If you chose to copy one of the template folders like `ABC` or `BCA` you can test InferLog Holmes on any file in the folder `part2`. `part1` will contain a file `task1.py` that by default does not work with the debugger. If you want to test this file with the debugger make sure to make the adjustments mentioned in the previous part.
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
15. Afterwards you could go to `task3.py` and run this task as well. The debugger should attach itself automatically to the new file.
