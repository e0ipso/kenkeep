import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  buildNotificationCommand,
  escapeAppleScriptString,
  sendOsNotification,
} from '../../src/lib/notifications.js';

describe('notifications', () => {
  it('builds a macOS osascript display notification command with escaped literals', () => {
    const command = buildNotificationCommand('darwin', {
      title: 'kenkeep "queue"',
      body: 'Line one\\line two\nrun /kk-curate',
    });

    expect(command).toEqual({
      command: 'osascript',
      args: [
        '-e',
        'display notification "Line one\\\\line two\\nrun /kk-curate" with title "kenkeep \\"queue\\""',
      ],
    });
  });

  it('builds a Linux notify-send command with a kenkeep app identity', () => {
    expect(
      buildNotificationCommand('linux', {
        title: 'kenkeep curation overdue',
        body: '20 pending sessions',
      })
    ).toEqual({
      command: 'notify-send',
      args: ['--app-name=kenkeep', 'kenkeep curation overdue', '20 pending sessions'],
    });
  });

  it('skips unsupported platforms', () => {
    expect(buildNotificationCommand('win32', { title: 'x', body: 'y' })).toBeNull();
  });

  it('escapes AppleScript string literal metacharacters', () => {
    expect(escapeAppleScriptString('quote " slash \\ newline\n')).toBe(
      'quote \\" slash \\\\ newline\\n'
    );
  });

  it('treats spawn failures as non-fatal and does not wait for delivery', () => {
    const child = new EventEmitter();
    const spawn = vi.fn(() => child);

    expect(() =>
      sendOsNotification(
        { title: 'kenkeep', body: 'body' },
        { platform: 'linux', spawn: spawn as never }
      )
    ).not.toThrow();
    expect(spawn).toHaveBeenCalledWith('notify-send', ['--app-name=kenkeep', 'kenkeep', 'body'], {
      detached: true,
      shell: false,
      stdio: 'ignore',
    });

    expect(() => child.emit('error', new Error('missing notify-send'))).not.toThrow();
  });
});
