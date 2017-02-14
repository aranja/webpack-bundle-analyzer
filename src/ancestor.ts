import union = require('lodash/union');
import includes = require('lodash/includes');

type ReadParentsCallback<T> = (node: T) => T[];

class Walker<T> {
	node: T;
	visited: T[];

	constructor(startNode: T) {
		this.visited = [];
		this.node = startNode;
	}

	merge(walker: Walker<T>) {
		this.visited = union(this.visited, walker.visited);
	}

	branch(startNode: T) {
		const walker = new Walker(startNode);
		walker.merge(this);
		return walker;
	}
}

export function soleAncestor<T>(startNodes: T[], readParents: ReadParentsCallback<T>): T | undefined {
	if (startNodes.length < 2) return startNodes[0];

	const walkerStack = startNodes.map(each => new Walker(each));

	while (walkerStack.some(walker => walker.node != null)) {
		const walker = walkerStack.shift() as Walker<T>;
		if (walker == null) {
			throw new Error('Empty walter stack. Should never happen.');
		}

		const node = walker.node;
		if (node == null) {
			walkerStack.push(walker);
			continue;
		}

		const walkerWithCommonAncestor = walkerStack.find(otherWalker => includes(otherWalker.visited, node));
		if (walkerWithCommonAncestor) {
			if (walkerStack.length === 1) {
				return node;
			} else {
				walkerWithCommonAncestor.merge(walker);
			}
		} else {
			walker.visited.push(node);
			const [first, ...others] = readParents(node);
			walker.node = first;
			walkerStack.push(walker);
			others.forEach(node => walkerStack.push(walker.branch(node)));
		}
	}
}
