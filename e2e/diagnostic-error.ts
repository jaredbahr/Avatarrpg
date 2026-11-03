import type { TestInfo } from '@playwright/test';

/** Preserve Playwright's original failure while adding state to its GitHub annotation. */
export function appendDiagnosticToExistingError(
  testInfo: TestInfo,
  label: string,
  payload: string,
) {
  const originalError = testInfo.errors[0];
  if (!originalError) return;
  const context = `\n${label}: ${payload}`;
  originalError.message = `${originalError.message ?? ''}${context}`;
  if (originalError.stack) originalError.stack += context;
}
