import { HelpfulWarningBlockType, type Block } from "../utilities/warnings";
import { NormalDistribution } from "./distribution";
import { ConcretePPL, type UnifiedParameterNames, type WarningType } from "./ppli";

export class MinimalPPL extends ConcretePPL {
	constructor() {
		super();
	}

	reparameterize(source: string): string {
		const found = source.match(regex) as [string, string, string, string, string, string];

		let rawNameParts = found[2].match(/(f?['"])(.+?)(_\{.*\})?(['"])/)  as [string, string, string, string, string];
		let rawName = `${rawNameParts[1]}${rawNameParts[2]}_raw${rawNameParts[3] || ""}${rawNameParts[4] || ""}`;

		return `${found[1]}_raw = sample(${rawName}, ${found[3]}(0, 1))<br>${found[1]} = deterministic(${rawNameParts[1]}${rawNameParts[2]}${rawNameParts[3] || ""}${rawNameParts[4] || ""}, ${found[5]} * ${found[1]}_raw + ${found[4]})`;
	}

	getParameterName(unifiedName: UnifiedParameterNames): string {
		switch(unifiedName) {
			case "stepsize":
				return "stepsize";
			case "burnin":
				return "burnin";
		}
	}

	maybeAddPPLInfoBlock(warning: WarningType, block: Block): Block {
		switch(warning) {
			case "Burnin":
				block.addBlock(HelpfulWarningBlockType.PPLInfo, "Burnin is not supported by this PPL. You have to discard Burnin samples manually.");
				break;
		}
		return block;
	}
}

/**
 * **Example**:
 * theta = sample(f"theta_{j}", dist.Normal(mu, tau**2))
 * 
 * **Result**:
 * [	
 * 	everything, 
 * 	'f"theta_{j}"', 
 * 	"dist.Normal", 
 * 	"mu", 
 * 	"tau**2"
 * ]
 */
const regex = /(\w+)\s*=\s*sample\(\s*(f?['"].+['"])\s*,\s*(.+)\((.+)\s*,\s*(.*)\).*\).*/;