import { Webview } from "vscode";
import { CONSEC_NUMBER_GENERATOR } from "./helper";

export type MessageCommand = 'confirmReceive' | 'setState' | 'first' | 'second' | 'addTraceItem' | 'addTraceBatch' | 'start'

export type WebViewMessage = {
	command: MessageCommand,
	data: any
}

type InternalWebViewMessage = {
	MESSAGE_ID: number,
	command: MessageCommand,
	data: any
}

export class ReplayMessages {
	private outStandingMessages: InternalWebViewMessage[] = [];
	private idGenerator = CONSEC_NUMBER_GENERATOR;
	private interval: NodeJS.Timeout | null = null;
	pendingRequest: ((id: number) => void) | null = null;

	constructor(private webView: Webview) {
		webView.onDidReceiveMessage(message => {
			if(this.pendingRequest != null && message.command == 'confirmReceive' && message.MESSAGE_ID != null) {
				this.pendingRequest(message.MESSAGE_ID);
				this.pendingRequest = null;
			}
		})
	}

	public async send(message: WebViewMessage): Promise<boolean> {
		let sendableMessage = {
			MESSAGE_ID: this.idGenerator.next().value,
			...message
		}
		let res = await this.internalSend(sendableMessage);
		if(!res) {
			this.outStandingMessages.push(sendableMessage);
			if(this.interval == null) {
				this.interval = setInterval(async () => await this.replay(), 500);
			}
		}
		return res;
	}

	private async internalSend(message: InternalWebViewMessage): Promise<boolean> {
		return new Promise(async (resolve, _reject) => {
			this.pendingRequest = (id: number) => {
				id == message.MESSAGE_ID ? resolve(true) : resolve(false);
			};
			let res = await this.webView.postMessage(message)

			if(!res) {
				this.pendingRequest = null;
				resolve(false);
			} else {
				setTimeout(() => {
					this.pendingRequest = null;
					resolve(false);
				}, 500);
			}
		});
	}

	public async destroy() {
		if(this.interval != null) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	public async replay() {
		for(let i = 0; i < this.outStandingMessages.length; i++) {
			let res = await this.internalSend(this.outStandingMessages[i]);
			if(res) {
				this.outStandingMessages.splice(i, 1);
				i--;
			} else {
				return;
			}
		}

		if(this.outStandingMessages.length == 0 && this.interval != null) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}
} 