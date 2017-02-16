import union = require('lodash/union');
import uniq = require('lodash/uniq');
import difference = require('lodash/difference');

type ReadParentsCallback<T> = (node: T) => T[];

export function soleAncestor<T>(startNodes: T[], readParents: ReadParentsCallback<T>): T | undefined {
	if (startNodes.length < 2) return startNodes[0];

	const seenMap = new Map<T, T[]>();
	const missingMap = new Map<T, T[]>();
	const nodeStack = startNodes.slice();

	startNodes.forEach(node => {
		seenMap.set(node, [node]);
		missingMap.set(node, startNodes.filter(other => other !== node));
	});

	while (nodeStack.length) {
		const node = nodeStack.shift() as T;
		const missing = missingMap.get(node) as T[];
		const seen = seenMap.get(node) as T[];
		if (missing.length === 0) {
			return node;
		}

		const parents = readParents(node);
		nodeStack.push(...parents);
		uniq(nodeStack);

		for (const parent of parents) {
			const parentSeen = seenMap.get(parent) || [parent];
			const parentMissing = missingMap.get(parent) || [];
			const combinedSeen = union(parentSeen, seen);
			const combinedMissing = union(parentMissing, missing, parents);
			seenMap.set(parent, combinedSeen);
			missingMap.set(parent, difference(combinedMissing, combinedSeen));
		}
	}
}
