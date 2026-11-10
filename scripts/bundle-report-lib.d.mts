export type ChunkReport = {
  compressedBytes: number;
  modules: Map<string, number>;
};

export type BundleReport = {
  total: number;
  modules: Map<string, number>;
};

export function decodeMappings(mappings: string): number[][][];
export function analyzeChunk(options: {
  file: string;
  mapFile?: string;
  mapValue?: string;
  mapBasePath?: string;
  rootDir: string;
  content: Buffer;
}): ChunkReport;
export function foldFolder(module: string): string;
export function aggregate(chunks: ChunkReport[]): BundleReport;
export function renderMarkdown(current: BundleReport, base?: BundleReport | null): string;
