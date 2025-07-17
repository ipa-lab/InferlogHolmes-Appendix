import type { Block } from "../utilities/warnings";

export type UnifiedParameterNames = "stepsize" | "burnin"
export type WarningType = "HighACCRate" | "LowACCRate" | "StuckChain" | "Burnin" | "Funnel" | "ESS";

export abstract class ConcretePPL {
	constructor() {

	}

	abstract reparameterize(source: string): string;

	abstract getParameterName(unifiedName: UnifiedParameterNames): string;

	abstract maybeAddPPLInfoBlock(warning: WarningType, block: Block): Block;
}

