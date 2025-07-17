#!/bin/bash

python static/py/server.py &

cd study
code tunnel --name holmes-92u3s-${PARTICIPANT} --install-extension /usr/src/ppl_debugger.vsix --install-extension ms-python.python --install-extension ms-toolsai.jupyter --accept-server-license-terms