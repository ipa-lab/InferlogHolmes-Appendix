"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const json_rpc_2_0_1 = require("json-rpc-2.0");
const http = require("http");
const workerInterface_1 = require("./workerInterface");
let currentTraceBatch = [];
let warningWorker = null;
let currentInterval = null;
function* enumerate(n) {
    for (let i = 0; i < n; i++) {
        yield i;
    }
}
//var http = require('http');
http.createServer(function (req, res) {
    let body = '';
    switch (req.url) {
        case "/start":
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                state.app.debuggingSession = JSON.parse(body);
                if (state.app.debuggingSession.filePath && PPLDebuggerPanel.currentPanel && state.app.debuggingSession.filePath != PPLDebuggerPanel.currentPanel?._modelPath) {
                    PPLDebuggerPanel.currentPanel._modelPath = state.app.debuggingSession.filePath;
                    PPLDebuggerPanel.currentPanel._update();
                    vscode.window.showInformationMessage(`Model changed to ${state.app.debuggingSession.filePath}`);
                }
                state.app.debuggingSession.trace = [...enumerate(state.app.debuggingSession.chains)].map(x => []);
                currentTraceBatch = [...enumerate(state.app.debuggingSession.chains)].map(x => []);
                PPLDebuggerPanel.currentPanel?.httpMsg(state.app.debuggingSession);
                if (currentInterval != null) {
                    clearInterval(currentInterval);
                    currentInterval = null;
                }
                currentInterval = setInterval(async () => {
                    if (warningWorker != null) {
                        let batch = [...currentTraceBatch];
                        let res = warningWorker.getNewWarnings(batch);
                        currentTraceBatch = currentTraceBatch.map(x => []);
                        let stats = await res;
                        //console.log("MAIN:", batch, warnings, essOverTime);
                        await PPLDebuggerPanel.currentPanel?.addTraceBatch({ batch, stats });
                    }
                }, 5 * 1000);
                res.writeHead(201);
                res.end();
            });
            break;
        case "/trace":
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                if (!state.app.debuggingSession) {
                    vscode.window.showErrorMessage("Debugging Session not started");
                    return;
                }
                try {
                    let dt = JSON.parse(body);
                    dt.trace_current = fixArrayTrace(dt.trace_current);
                    dt.trace_proposed = fixArrayTrace(dt.trace_proposed);
                    state.app.debuggingSession.trace[dt.chain].push(dt);
                    currentTraceBatch[dt.chain].push(dt);
                    if (state.app.debuggingSession.trace.reduce((acc, c) => acc + c.length, 0) == state.app.debuggingSession.totalIteration * state.app.debuggingSession.chains) {
                        cleanUp();
                    }
                    res.writeHead(201);
                    res.end();
                    /*PPLDebuggerPanel.currentPanel?.addTraceItem(dt, dt.chain).then(() => {
                        res.writeHead(201);
                        res.end();
                    }); */
                }
                catch (e) {
                    console.log(body);
                    throw e;
                }
            });
            break;
        case "/trace-batch":
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                if (!state.app.debuggingSession) {
                    vscode.window.showErrorMessage("Debugging Session not started");
                    return;
                }
                try {
                    let dt = JSON.parse(body);
                    dt.forEach(x => {
                        x.trace_current = fixArrayTrace(x.trace_current);
                        x.trace_proposed = fixArrayTrace(x.trace_proposed);
                        //@ts-ignore
                        state.app.debuggingSession.trace[x.chain].push(x);
                        currentTraceBatch[x.chain].push(x);
                    });
                    if (state.app.debuggingSession.trace.reduce((acc, c) => acc + c.length, 0) == state.app.debuggingSession.totalIteration * state.app.debuggingSession.chains) {
                        cleanUp();
                    }
                    res.writeHead(201);
                    res.end();
                    /*PPLDebuggerPanel.currentPanel?.addTraceItem(dt, dt.chain).then(() => {
                        res.writeHead(201);
                        res.end();
                    }); */
                }
                catch (e) {
                    console.log(body);
                    throw e;
                }
            });
            break;
        default:
            res.writeHead(200, { 'Content-Type': 'text/html' });
            vscode.window.showErrorMessage("Hello From HTTP");
            if (PPLDebuggerPanel.currentPanel) {
                //PPLDebuggerPanel.currentPanel.httpMsg();
            }
            res.write('Hello World!');
            res.end();
            break;
    }
}).listen(8484);
async function cleanUp() {
    if (currentInterval != null) {
        clearInterval(currentInterval);
        currentInterval = null;
    }
    if (warningWorker != null) {
        let batch = [...currentTraceBatch];
        let res = warningWorker.getFinalReport(batch);
        currentTraceBatch = currentTraceBatch.map(x => []);
        let stats = await res;
        await PPLDebuggerPanel.currentPanel?.addTraceBatch({ batch, stats });
        warningWorker.worker.terminate();
        warningWorker = null;
    }
}
function fixArrayTrace(trace) {
    let fixedCurrentTrace = {};
    for (let key of Object.keys(trace)) {
        if (Array.isArray(trace[key])) {
            for (let i = 0; i < trace[key].length; i++) {
                fixedCurrentTrace[`${key}_${i}`] = trace[key][i];
            }
        }
        else {
            fixedCurrentTrace[key] = trace[key];
        }
    }
    return fixedCurrentTrace;
}
const state = {
    local: {
        rpcClient: undefined,
        treeId: undefined
    },
    app: {
        filePath: undefined,
        model: undefined,
        modelGraph: undefined,
        randomVariables: undefined,
        debuggingSession: undefined,
        funnel: undefined
    }
};
state.local.rpcClient = new json_rpc_2_0_1.JSONRPCClient((jsonRPCRequest) => fetch("http://localhost:4000/jsonrpc", {
    method: "POST",
    headers: {
        "content-type": "application/json",
    },
    body: JSON.stringify(jsonRPCRequest),
}).then((response) => {
    if (response.status === 200) {
        // Use client.receive when you received a JSON-RPC response.
        return response
            .json()
            .then((jsonRPCResponse) => state.local.rpcClient?.receive(jsonRPCResponse));
    }
    else if (jsonRPCRequest.id !== undefined) {
        return Promise.reject(new Error(response.statusText));
    }
}));
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('pplDebugger.start', () => {
        PPLDebuggerPanel.createOrShow(context);
    }));
    if (vscode.window.registerWebviewPanelSerializer) {
        // Make sure we register a serializer in activation event
        vscode.window.registerWebviewPanelSerializer(PPLDebuggerPanel.viewType, {
            async deserializeWebviewPanel(webviewPanel, state) {
                console.log(`Got state: ${state}`);
                // Reset the webview options so we use latest uri for `localResourceRoots`.
                webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
                PPLDebuggerPanel.revive(webviewPanel, context.extensionUri, context, state);
            }
        });
    }
}
exports.activate = activate;
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        //TODO: FALLBACK
        retainContextWhenHidden: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
    };
}
/**
 * Manages cat coding webview panels
 */
class PPLDebuggerPanel {
    static createOrShow(context) {
        const extensionUri = context.extensionUri;
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn && (vscode.window.activeTextEditor.viewColumn % 3) + 1
            : undefined;
        if (!vscode.window.activeTextEditor || (!vscode.window.activeTextEditor.document.fileName.endsWith(".py") && !vscode.window.activeTextEditor.document.fileName.endsWith(".ipynb"))) {
            vscode.window.showErrorMessage("Currently only Python files are supported for Debugging!");
            return;
        }
        let modelPath = vscode.window.activeTextEditor.document.fileName;
        // If we already have a panel, show it.
        if (PPLDebuggerPanel.currentPanel) {
            PPLDebuggerPanel.currentPanel._panel.reveal(column);
            if (PPLDebuggerPanel.currentPanel._modelPath != modelPath) {
                vscode.window
                    .showInformationMessage(`Are you sure you want to start debugging a new model?`, { detail: "Your current debugging state will be lost!", modal: true }, "Yes")
                    .then(answer => {
                    if (answer === "Yes") {
                        PPLDebuggerPanel.currentPanel?.dispose();
                        setTimeout(() => {
                            this.createOrShow(context);
                        }, 100);
                    }
                });
            }
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(PPLDebuggerPanel.viewType, 'PPL Debugger', {
            viewColumn: column || vscode.ViewColumn.One,
            preserveFocus: true
        }, getWebviewOptions(extensionUri));
        PPLDebuggerPanel.currentPanel = new PPLDebuggerPanel(panel, extensionUri, context, modelPath);
        PPLDebuggerPanel.currentPanel.firstMsg();
    }
    static revive(panel, extensionUri, ctx, state) {
        PPLDebuggerPanel.currentPanel = new PPLDebuggerPanel(panel, extensionUri, ctx, state.filePath);
    }
    constructor(panel, extensionUri, ctx, modelPath) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._ctx = ctx;
        this._modelPath = modelPath;
        //this._messagePoster = new ReplayMessages(panel.webview);
        // Set the webview's initial html content
        this._update();
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
                case 'generateGraph':
                    this.firstMsg();
                    return;
                case 'debugFile':
                    this.debugCurrentModel();
                    return;
                case 'gotoline':
                    vscode.workspace.openTextDocument(vscode.Uri.file(this._modelPath)).then(document => vscode.window.showTextDocument(document, {
                        selection: new vscode.Range(new vscode.Position(message.data[0], message.data[1]), new vscode.Position(message.data[2], message.data[3])),
                        viewColumn: ((this._panel.viewColumn || 1) - 1) || 3
                    }));
                    //vscode.window.showTextDocument(
                    //	vscode.Uri.file(this._modelPath), 
                    //	{selection: new vscode.Range(new vscode.Position(message.data[0], message.data[1]), new vscode.Position(message.data[2], message.data[3]))}
                    //);
                    return;
            }
        }, null, this._disposables);
        state.app.filePath = modelPath;
        this.setStateMsg(state.app);
    }
    debugCurrentModel() {
        if (this._modelPath) {
            const terminal = vscode.window.createTerminal(`Debug ${this._modelPath.replace(/^.*[\\/]/, '')}`);
            terminal.show(true);
            terminal.sendText(`python ${this._modelPath}`);
        }
        else {
            vscode.window.showErrorMessage("No model loaded!");
        }
    }
    setStateMsg(state) {
        this._panel.webview.postMessage({ command: 'setState', data: JSON.stringify(state) });
    }
    firstMsg(truelyClean = false) {
        const is_descendant = (parent, child) => {
            return parent.first_byte <= child.first_byte && child.last_byte <= parent.last_byte;
        };
        state.local.rpcClient
            ?.request("build_ast", { file_name: this._modelPath, ppl: null, n_unroll_loops: 0 })
            .then((result) => {
            state.local.treeId = result;
            return state.local.rpcClient?.request("get_model", { tree_id: state.local.treeId });
        })
            .then((result) => {
            state.app.model = result;
            return state.local.rpcClient?.request("get_graph", { tree_id: state.local.treeId, model: state.app.model });
        })
            .then((result) => {
            state.app.modelGraph = result;
            return state.local.rpcClient?.request("get_call_graph", { tree_id: state.local.treeId, node: state.app.model?.node });
        })
            .then((callGraph) => {
            return state.local.rpcClient?.request("get_random_variables", { tree_id: state.local.treeId })
                .then((rvs) => {
                let callGraphNodes = [...new Set(callGraph.map(n => n.caller))];
                return rvs.filter(rv => callGraphNodes.find((c) => is_descendant(c, rv.node)));
            });
        })
            .then((result) => {
            state.app.randomVariables = result;
            return state.local.rpcClient?.request("get_funnel_relationships", { tree_id: state.local.treeId, model: state.app.model });
        })
            .then((result) => {
            state.app.funnel = result;
            if (truelyClean) {
                this._panel.webview.postMessage({ command: 'setStateClean', data: JSON.stringify(state.app) });
            }
            else {
                this._panel.webview.postMessage({ command: 'setStateFunnel', data: JSON.stringify(state.app) });
            }
        });
    }
    secondMsg(trace) {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        this._panel.webview.postMessage({ command: 'second', data: JSON.stringify(trace) });
    }
    async addTraceItem(traceItem, chain) {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        await this._panel.webview.postMessage({ command: 'addTraceItem', data: JSON.stringify({ traceItem, chain }) });
    }
    async addTraceBatch(data) {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        await this._panel.webview.postMessage({ command: 'addTraceBatch', data: JSON.stringify(data) });
    }
    httpMsg(debuggingState) {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        warningWorker?.worker.terminate();
        warningWorker = new workerInterface_1.WorkerInterface(this._ctx, { debuggingState, knownFunnels: state.app.funnel });
        this._panel.webview.postMessage({ command: 'start', data: JSON.stringify(debuggingState) });
    }
    dispose() {
        PPLDebuggerPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.title = `Debug ${this._modelPath.replace(/^.*[\\/]/, '')}`;
        //TODO: Comment Line out
        //this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
        // And the uri we use to load this script in the webview
        //const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        // Local path to css styles
        //const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
        //const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'assets', 'index.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'assets', 'index.js'));
        // Uri to load styles into webview
        //const stylesResetUri = webview.asWebviewUri(styleResetPath);
        //const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!doctype html>
			<html lang="en">
			  <head>
			    <meta charset="UTF-8" />
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; worker-src blob:; script-src 'nonce-${nonce}' 'unsafe-inline';">
			    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
			    <title>Vite + Svelte + TS</title>
			    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
			  </head>
			  <body>
			    <div id="app"></div>
			  </body>
			</html>
		`;
    }
}
PPLDebuggerPanel.viewType = 'pplDebugger';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map