/**
 * User-facing status lines for the per-harness capture hooks.
 *
 * Every adapter's `kk-capture` wrapper reports the outcome of the shared
 * pipeline through these helpers so the message always matches what happened
 * on disk: "saved" only when a session log was written, "skipped" with the
 * reason when nothing was, and the wrapper's own "capture error" line when the
 * pipeline threw.
 */
import type { CaptureResult } from './capture.js';

export const CAPTURE_SAVED_MESSAGE = '💾 kenkeep Capture: Session transcript saved.';

export function captureSkippedMessage(reason: string): string {
  return `⏭️ kenkeep Capture: Session transcript skipped (${reason}).`;
}

/** The status line for a completed (non-throwing) `captureSession` call. */
export function captureOutcomeMessage(result: CaptureResult): string {
  switch (result.status) {
    case 'written':
      return CAPTURE_SAVED_MESSAGE;
    case 'unchanged':
      return captureSkippedMessage('transcript unchanged since the last capture');
    case 'no-content':
      return captureSkippedMessage('transcript has no capturable content');
    case 'no-transcript':
      return captureSkippedMessage(result.error ?? 'no transcript available');
  }
}
