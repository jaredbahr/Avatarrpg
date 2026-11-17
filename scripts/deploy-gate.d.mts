/** The frozen identity written by `select` and carried through every deploy job. */
type GateEvidence = {
  /** Commit date of the selected SHA; written by `select` only. */
  committed_at?: string;
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

type ArtifactIdentity = {
  artifact_id: string;
  artifact_name: string;
};

type GateEnvironment = Record<string, string | undefined>;

/** Only these Response fields are read; fixtures can supply a smaller response. */
type GateHttpResponse = {
  status: number;
  redirected?: boolean;
  json(): Promise<unknown>;
};

type GateFetch = (url: URL, init: RequestInit) => Promise<GateHttpResponse>;
type GateOutput = GateEvidence | (GateEvidence & ArtifactIdentity);
type GateOutputWriter = (value: GateOutput, outputPath?: string) => Promise<unknown>;

type GateDispatchInput<Mode extends 'select' | 'revalidate'> = {
  mode: Mode;
  env: GateEnvironment;
  fetchImpl?: GateFetch;
  writeOutput?: GateOutputWriter;
};

type GateRevalidationResult = {
  evidence: GateEvidence;
  artifact?: ArtifactIdentity;
};

export function dispatchCommand(options: GateDispatchInput<'select'>): Promise<GateEvidence>;
export function dispatchCommand(
  options: GateDispatchInput<'revalidate'>,
): Promise<GateRevalidationResult>;
