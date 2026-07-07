import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOsNotification } from '../../src/lib/notifications.js';
import { notificationIconPath } from '../../src/lib/paths.js';
import { sendSessionStartNotifications } from '../../src/lib/session-start.js';
import type { SessionStartResult } from '../../src/lib/session-start.js';

vi.mock('../../src/lib/notifications.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/notifications.js')>();
  return { ...actual, sendOsNotification: vi.fn() };
});

describe('notificationIconPath', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-notification-icon-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns the kk assets path when the icon is present', () => {
    const kkDir = join(root, '.ai', 'kenkeep');
    const icon = join(kkDir, 'assets', 'notification-icon.png');
    mkdirSync(join(kkDir, 'assets'), { recursive: true });
    writeFileSync(icon, 'png');
    expect(notificationIconPath(kkDir)).toBe(icon);
  });

  it('returns null when the icon is absent', () => {
    const kkDir = join(root, '.ai', 'kenkeep');
    mkdirSync(kkDir, { recursive: true });
    expect(notificationIconPath(kkDir)).toBeNull();
  });
});

describe('sendSessionStartNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseResult: SessionStartResult = {
    additionalContext: '# kenkeep\n',
    nudged: true,
    lintNudged: false,
    indexMissing: false,
    indexStale: false,
    curationLoud: false,
    pendingSessions: 1,
    candidateCount: 0,
    oldestPendingAgeDays: null,
    freshnessAdvisory: null,
    repoRoot: '/tmp/repo',
    projectName: 'repo',
    hostName: 'host',
  };

  it('forwards the kk notification icon path to sendOsNotification', () => {
    const kkDir = mkdtempSync(join(tmpdir(), 'kk-send-notification-'));
    const icon = join(kkDir, 'assets', 'notification-icon.png');
    mkdirSync(join(kkDir, 'assets'), { recursive: true });
    writeFileSync(icon, 'png');

    sendSessionStartNotifications(
      { notifications: { enabled: true, backends: {} } },
      baseResult,
      kkDir
    );

    expect(sendOsNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'kenkeep: repo on host' }),
      { iconPath: icon }
    );

    rmSync(kkDir, { recursive: true, force: true });
  });
});
