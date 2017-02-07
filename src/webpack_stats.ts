export type Milliseconds = number;
export type Bytes = number;
export type Path = string;

export interface WebpackAsset {
	name: string;
	size: Bytes;
	chunks: number[];
	chunkNames: string[];
	emitted: boolean;
}

export interface WebpackChunk {
	// TODO
}

export interface WebpackReason {
	moduleId: number;
}

export interface WebpackModule {
	id: number;
	identifier: Path;
	name: string;
	size: Bytes;
	reasons: WebpackReason[];
}

export interface CompilationBase {
	name?: string;
	errors: any[];
	hash: string;
	version: string;
	warnings: any[];
}

/** JSON structure produced when Webpack config
  * is an array of bundles.
  */
export interface WebpackMultiCompilation extends CompilationBase {
	children: WebpackCompilation[];
}

/** JSON structure produced for a single bundle generated by
  * a Webpack compilation.
  */
export interface WebpackCompilation extends CompilationBase {
	time: Milliseconds;
	assetsByChunkName: {[chunkName: string]: string};
	assets: WebpackAsset[];
	chunks: WebpackChunk[];
	modules: WebpackModule[];
}

/** JSON structure of `webpack --json` output */
export type WebpackStats = WebpackMultiCompilation | WebpackCompilation;

export function isMultiCompilation(stats: WebpackStats):
	stats is WebpackMultiCompilation {
	return !stats.hasOwnProperty('modules');
}

