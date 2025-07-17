import { HelpfulWarningBlockType, type Block } from "../utilities/warnings";
import { NormalDistribution } from "./distribution";
import { ConcretePPL, type UnifiedParameterNames, type WarningType } from "./ppli";

// TODO: Implement for more distributions than just Normal
export class PYMC extends ConcretePPL {
	constructor() {
		super();
	}

	reparameterize(source: string): string {
		const found = source.match(initialRegex);
		if (!found) {
			return source;
		}

		let params: { key: string, value: string }[] = [];
		for (let match of (found[4] + ")").matchAll(paramRegex)) {
			params.push({ key: match[1], value: match[2].trim() });
		}

		let rawNameParts = found[3].match(/(f?['"])(.+?)(_\{.*\})?(['"])/);
		let rawName = `${rawNameParts[1]}${rawNameParts[2]}_raw${rawNameParts[3] || ""}${rawNameParts[4] || ""}`;

		const NEUTRAL_PARAMS = this.getNeutralParams(found[2], params);
		const DETERMINISTIC_FORMULAR = this.getDeterministicRescaling(found[2], `${found[1]}_raw`, params);

		let res = `${found[1]}_raw = ${found[2]}(${rawName}, ${NEUTRAL_PARAMS})<br>${found[1]} = pm.Deterministic(${found[3]}, ${DETERMINISTIC_FORMULAR})`;

		return res;
	}

	getParameterName(unifiedName: UnifiedParameterNames): string {
		switch(unifiedName) {
			case "stepsize":
				return "step_scale";
			case "burnin":
				return "tune";
		}
	}

	maybeAddPPLInfoBlock(warning: WarningType, block: Block): Block {
		switch(warning) {
			case "ESS":
				block.addBlock(
					HelpfulWarningBlockType.PPLInfo, 
					"PYMC does automatic step_scale tuning if the tuning period is larger than 0. "
					+ "In some cases this can lead to a sub-optimal step size. "
					+ "If issues persist, consider setting adapt_step_size=False in your step function or adjusting the target_accept parameters.")
				break;
		}
		return block;
	}

	private getDeterministicRescaling(dist: string, rawName: string, params: { key: string, value: string }[]): string {
		if (dist == "pm.Normal") {
			return new NormalDistribution().formular(params.find(k => k.key == "mu")?.value, params.find(k => k.key == "sigma")?.value, rawName);
		}
	}

	private getNeutralParams(dist: string, params: { key: string, value: string }[]): string {
		let transform: any = {};
	
		if (dist == "pm.Normal") {
			let neutral = new NormalDistribution().getNeutralParams();
			transform = {
				"mu": neutral.location,
				"sigma": neutral.scale
			}
		}
	
		let res = params
			.map(param => transform[param.key] != null ? `${param.key}=${transform[param.key]}` : `${param.key}=${param.value}`)
			.join(", ");
	
		console.log("TRANSFORM", res);
		return res;
	}

}

/**
 * Extracts named parameters (key-value pairs) from a function-like string.
 * The regex captures:
 *  - Keys (parameter names) which consist of word characters (letters, numbers, underscore).
 *  - Values, which can either be:
 *    - Parenthesized expressions (e.g., `(8,)`) to handle tuple-like values.
 *    - Non-parenthesized values that avoid capturing commas separating other parameters.
 *
 * Regex Breakdown:
 *
 * /(\w+)\s*=\s*(\([^()]*\)|(?:[^,(]|\,(?!\s*\w+\s*=))+?)(?=,|\))/g
 *
 * - `(\w+)`          → Captures the key (parameter name), consisting of word characters.
 * - `\s*=\s*`        → Matches an equals sign (`=`) with optional surrounding whitespace.
 * - `(\([^()]*\)|(?:[^,(]|\,(?!\s*\w+\s*=))+?)`
 *   - `\([^()]*\)`   → Captures values enclosed in parentheses (e.g., `(8,)`), assuming no nested parentheses.
 *   - `(?:[^,(]|\,(?!\s*\w+\s*=))+?`
 *     - `[^,(]`      → Matches any character that is **not** a comma or opening parenthesis.
 *     - `\,(?!\s*\w+\s*=)` → Matches a comma **only** if it is **not** followed by another key-value pair.
 *     - `+?`         → Lazily matches as few characters as possible to avoid overmatching.
 * - `(?=,|\))`       → A lookahead that ensures matching stops before a `,` or `)`, preventing extra characters from being captured.
 * **/
const paramRegex = /(\w+)\s*=\s*(\([^()]*\)|(?:[^,(]|\,(?!\s*\w+\s*=))+?)(?=,|\))/g;

/**
 * **Example**:
 * theta = pm.Normal("theta", mu = mu, sigma=tau ** 2, shape=(8,), observed=tsz)
 * 
 * **Result**:
 * [everything, "theta", "pm.Normal", ""theta"", rest]
 */
const initialRegex = /(\w+)\s*=\s*(pm\.\w+)\(\s*(f?(?:'.+')|f?(?:".+"))\s*,\s?(.+)\)/
