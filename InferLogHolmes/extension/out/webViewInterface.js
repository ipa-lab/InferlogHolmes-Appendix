"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayMessages = void 0;
const helper_1 = require("./helper");
class ReplayMessages {
    constructor(webView) {
        this.webView = webView;
        this.outStandingMessages = [];
        this.idGenerator = helper_1.CONSEC_NUMBER_GENERATOR;
        this.interval = null;
        this.pendingRequest = null;
        webView.onDidReceiveMessage(message => {
            if (this.pendingRequest != null && message.command == 'confirmReceive' && message.MESSAGE_ID != null) {
                this.pendingRequest(message.MESSAGE_ID);
                this.pendingRequest = null;
            }
        });
    }
    async send(message) {
        let sendableMessage = {
            MESSAGE_ID: this.idGenerator.next().value,
            ...message
        };
        let res = await this.internalSend(sendableMessage);
        if (!res) {
            this.outStandingMessages.push(sendableMessage);
            if (this.interval == null) {
                this.interval = setInterval(async () => await this.replay(), 500);
            }
        }
        return res;
    }
    async internalSend(message) {
        return new Promise(async (resolve, _reject) => {
            this.pendingRequest = (id) => {
                id == message.MESSAGE_ID ? resolve(true) : resolve(false);
            };
            let res = await this.webView.postMessage(message);
            if (!res) {
                this.pendingRequest = null;
                resolve(false);
            }
            else {
                setTimeout(() => {
                    this.pendingRequest = null;
                    resolve(false);
                }, 500);
            }
        });
    }
    async destroy() {
        if (this.interval != null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    async replay() {
        for (let i = 0; i < this.outStandingMessages.length; i++) {
            let res = await this.internalSend(this.outStandingMessages[i]);
            if (res) {
                this.outStandingMessages.splice(i, 1);
                i--;
            }
            else {
                return;
            }
        }
        if (this.outStandingMessages.length == 0 && this.interval != null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
exports.ReplayMessages = ReplayMessages;
//# sourceMappingURL=webViewInterface.js.map