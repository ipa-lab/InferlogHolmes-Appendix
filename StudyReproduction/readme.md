# Setup the study Environment and Run InferLog Holmes

**Requires docker installed and running on your system!**

1. From the folder that contains this readme run `cd dockerFiles`.
2. Replace `code.deb` with `code_arm64.deb` or `code_x86.deb` depending on the architecture of your system.
3. Run `sudo docker build -t inferlog:holmes .`
4. Copy a template folder of your choosing e.g. `cp -R ../FullStudyAndTasksFolder/ABC ../participant`
5. Run `sudo docker run --name inferlog --env PARTICIPANT=p12 --volume {ABSOLUT_PATH_TO_PARTICIPANT_FOLDER}:/app/study inferlog:holmes`
6. Follow the instructions in the terminal to get access to VSCode Online
7. Wait 1-2 minutes after the link to `vscode.dev` appeared in your console and then follow it (should be: [https://vscode.dev/tunnel/holmes-92u3s-p12/app/study](https://vscode.dev/tunnel/holmes-92u3s-p12/app/study))
8. Follow the link and choose account type: GitHub
9. Press `F1` and enter: `Python: Select Interpreter` and make sure to select version `3.10`
10. Setup Finished!

## Use InferLog Holmes
- To start InferLog Holmes for any python file with a probabilistic model in it you can open the file and press `F1` and enter `PPL Debugger: Start Debugging File`.

- Make sure to import `import pymcdebug as pmd` and call `pmd.debug` instead of `pm.sample` for running inference.

- Run the file (best through the Play button or with python from the command line.)

- If you run any file that has a `pmd.debug` statement executed, the debugger will automatically attach itself to it.

### Test with one of the prepared Task Folders
If you chose to copy one of the template folders like `ABC` or `BCA` you can test InferLog Holmes on any file in the folder `part2`. `part1` will contain a file `task1.py` that by default does not work with the debugger. If you want to test this file with the debugger make sure to make the adjustments mentioned in the previous part.
