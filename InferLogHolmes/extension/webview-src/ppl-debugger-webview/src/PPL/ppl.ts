import { MinimalPPL } from "./minimal";
import { ConcretePPL } from "./ppli";
import { PYMC } from "./pymc";



export class PPL {
	public static getPPLByName(name: string): ConcretePPL {
		switch(name) {
			case "pymc":
				return new PYMC();
			case "Minimal":
				return new MinimalPPL();
			default:
				return new MinimalPPL();
		}
	}
	
	public static getPPL(source: string): ConcretePPL {
		const testPYMCRegex = /pm.\.+\(/;
		if (!testPYMCRegex.test(source)) {
			return new PYMC();
		} else {
			return new MinimalPPL()
		}
	}
}