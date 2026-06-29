import { spawn as nodeSpawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export interface OsNotification {
  title: string;
  body: string;
}

export interface NotificationCommand {
  command: string;
  args: string[];
}

type SpawnFn = (
  command: string,
  args: string[],
  options: { detached: boolean; shell: false; stdio: 'ignore' }
) => Pick<ChildProcess, 'unref' | 'on'>;

export interface SendOsNotificationOptions {
  platform?: NodeJS.Platform;
  spawn?: SpawnFn;
}

export function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}

export function buildNotificationCommand(
  platform: NodeJS.Platform,
  notification: OsNotification
): NotificationCommand | null {
  if (platform === 'darwin') {
    return {
      command: 'osascript',
      args: [
        '-e',
        `display notification "${escapeAppleScriptString(notification.body)}" with title "${escapeAppleScriptString(notification.title)}"`,
      ],
    };
  }

  if (platform === 'linux') {
    return {
      command: 'notify-send',
      args: ['--app-name=kenkeep', notification.title, notification.body],
    };
  }

  return null;
}

export function sendOsNotification(
  notification: OsNotification,
  opts: SendOsNotificationOptions = {}
): void {
  const platform = opts.platform ?? process.platform;
  const command = buildNotificationCommand(platform, notification);
  if (command === null) return;

  const spawn = opts.spawn ?? nodeSpawn;
  try {
    const child = spawn(command.command, command.args, {
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
    child.on?.('error', () => {
      // Best effort only: missing binaries, permissions, DBus, and headless
      // desktops must never affect hook startup.
    });
    child.unref?.();
  } catch {
    // Best effort only.
  }
}
