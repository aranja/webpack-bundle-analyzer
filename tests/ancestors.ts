import { equal } from 'assert';
import { soleAncestor } from '../src/ancestor';

const nodes = new Map<number, number[]>([
	[1, []],
	[2, [1]],
	[3, [2]],
	[4, [2]],
	[5, [4]],
	[6, [3, 5]],
	[7, [6]],
	[8, [5]],
	[9, [8]],
]);

const getParent = (node: number) : number[] => nodes.get(node) || [];

const test = (nodes : number[], ancestor : number) => {
	equal(ancestor, soleAncestor(nodes, getParent), `(${nodes.join(', ')}) => ${ancestor}`);
};

describe('soleAncestor()', () => {
	it('should return sole ancestor', () => {
		test([3], 3);
		test([7, 9], 2);
		test([9, 7], 2);
		test([6, 7], 6);
		test([6, 8], 2);
		test([8, 6], 2);
	});
});
