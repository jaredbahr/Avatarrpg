/** The frozen identity written by `select` and carried through every deploy job. */
export type GateEvidence = {
  sha: string;
  ci_run_id: string;
  ci_run_attempt: string;
  ci_workflow_id: string;
  ci_workflow_path: string;
  ci_event: string;
  ci_url: string;
  ci_job_ids: string;
  artifact_name: string;
};

export type ArtifactIdentity = {
  artifact_id: string;
  artifact_name: string;
};

export type GateEnvironment = Record<string, string | undefined>;

/** Only these Response fields are read; fixtures can supply a smaller response. */
export type GateHttpResponse = {
  status: number;
  redirected?: boolean;
  json(): Promise<unknown>;
};

export type GateFetch = (url: URL, init: RequestInit) => Promise<GateHttpResponse>;
export type GateOutput = GateEvidence | (GateEvidence & ArtifactIdentity);
export type GateOutputWriter = (value: GateOutput, outputPath?: string) => Promise<unknown>;

export type GateDispatchInput<Mode extends 'select' | 'revalidate'> = {
  mode: Mode;
  env: GateEnvironment;
  fetchImpl?: GateFetch;
  writeOutput?: GateOutputWriter;
};

export type GateRevalidationResult = {
  evidence: GateEvidence;
  artifact?: ArtifactIdentity;
};

export class GateError extends Error {
  constructor(message: string);
}

export function selectEvidence(env: GateEnvironment, fetchImpl?: GateFetch): Promise<GateEvidence>;
export function revalidateEvidence(
  env: GateEnvironment,
  expected: GateEvidence,
  stage: string,
  fetchImpl?: GateFetch,
): Promise<GateEvidence>;
export function verifyArtifactMetadata(
  env: GateEnvironment,
  expected: GateEvidence,
  artifactId: string | number | undefined,
  fetchImpl?: GateFetch,
): Promise<ArtifactIdentity>;

export function dispatchCommand(options: GateDispatchInput<'select'>): Promise<GateEvidence>;
export function dispatchCommand(
  options: GateDispatchInput<'revalidate'>,
): Promise<GateRevalidationResult>;
