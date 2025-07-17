export abstract class Distribution {
	isRepameterizable: boolean = false;
}

export abstract class Reparameterizable extends Distribution {
	constructor() {
		super();
	}
	abstract formular(location: string, scale: string, raw: string): string;
	abstract getNeutralParams(): NeutralParams;

	public isRepameterizable: true = true;
}

export interface NeutralParams {
	location: number;
	scale: number;
}

export class NormalDistribution extends Reparameterizable {
	constructor() {
		super();
	}

	public formular(location: string, scale: string, raw: string): string {
		return `${location} + ${scale} * ${raw}`;
	}

	public getNeutralParams(): NeutralParams {
		return {
			location: 0,
			scale: 1
		};
	}
}