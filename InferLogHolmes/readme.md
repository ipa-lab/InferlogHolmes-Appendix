# Build and Run InferLog Holmes from scratch

## Requirements:
- Node v20 or later
- VSCode with this workspace opened
- Python v3.10

## Step 1. Python Setup with conda
1. Run `conda create -n "holmes" -c conda-forge python=3.10`
2. Follow the instruction by conda to install and activate the environment
3. From the folder that contains this readme run: `pip install -r ../StudyReproduction/dockerFiles/requirements.txt` 
4. `pip install -e pymcdebug`

## Step 2. Start LASAPP
1. Run `python static/py/server.py`
2. Let LASAPP run in the background.

## Step 3. Build and run the extension
1. `cd extension/webview-src/ppl-debugger-webview`
2. `npm install`
3. `npm run build`
4. `cd ../../`
5. `npm install`
6. `npm run watch`
7. In VSCode: Press `F5`
8. After the new window opened press in the new window `F1` and enter `PPL Debugger: Start Debugging File`.
9. Run a python file with python from the "holmes" environment
10. Happy Debugging
