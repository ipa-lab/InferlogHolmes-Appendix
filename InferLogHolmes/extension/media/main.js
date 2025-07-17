// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ s_count: number, r_count: number} | undefined} */ (vscode.getState());

    const s_counter = /** @type {HTMLElement} */ (document.getElementById('sent-counter'));
    const r_counter = /** @type {HTMLElement} */ (document.getElementById('received-counter'));
    const btn = /** @type {HTMLElement} */ (document.getElementById('send-message-btn'));
    const btnGo = /** @type {HTMLElement} */ (document.getElementById('gotoline-btn'));
    const last_msg = /** @type {HTMLElement} */ (document.getElementById('last-message'));
    console.log('Initial state', oldState);

    let s_currentCount = (oldState && oldState.s_count) || 0;
    let r_currentCount = (oldState && oldState.r_count) || 0;

    s_counter.textContent = `Messages Sent: ${s_currentCount}`;
    r_counter.textContent = `Messages Received: ${r_currentCount}`;

    let sendMessage = () => {
        s_counter.textContent = `Messages Sent: ${++s_currentCount} `;

        // Update state
        vscode.setState({ s_count: s_currentCount, r_count: r_currentCount });
 
        vscode.postMessage({
            command: 'alert',
            text: 'Hello from WebView Interaction'
        });
    };

    btnGo.addEventListener("click", (ev) => {
        vscode.postMessage({
            command: 'gotoline',
            text: 'Hello from WebView Interaction'
        });
    });

    btn.addEventListener("click", (ev) => {
        sendMessage()
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'first':
                r_counter.textContent = `Messages Received: ${++r_currentCount}`;
                last_msg.innerHTML = message.data;
                // Update state
                vscode.setState({ s_count: s_currentCount, r_count: r_currentCount });
                break;

            case 'second':
                r_counter.textContent = `Messages Received: ${++r_currentCount}`;
                last_msg.innerHTML = "Last Message: <b>Message B</b>";
                // Update state
                vscode.setState({ s_count: s_currentCount, r_count: r_currentCount });
                break;

            case 'http':
                r_counter.textContent = `Messages Received: ${++r_currentCount}`;
                last_msg.innerHTML = "Last Message: <b>HTTP message</b>";
                // Update state
                vscode.setState({ s_count: s_currentCount, r_count: r_currentCount });
                break;
        }
    });
}());
