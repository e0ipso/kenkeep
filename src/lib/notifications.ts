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
  iconPath?: string | null;
}

export function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}

export function buildNotificationCommand(
  platform: NodeJS.Platform,
  notification: OsNotification,
  iconPath?: string | null
): NotificationCommand | null {
  if (platform === 'darwin') {
    // macOS AppleScript display notification does not accept a standalone icon
    // path; the host shows the Terminal/script runner icon instead.
    return {
      command: 'osascript',
      args: [
        '-e',
        `display notification "${escapeAppleScriptString(notification.body)}" with title "${escapeAppleScriptString(notification.title)}"`,
      ],
    };
  }

  if (platform === 'linux') {
    const args = ['--app-name=kenkeep'];
    if (iconPath) {
      args.push(`--icon=${iconPath}`);
    }
    args.push(notification.title, notification.body);
    return {
      command: 'notify-send',
      args,
    };
  }

  return null;
}

export function sendOsNotification(
  notification: OsNotification,
  opts: SendOsNotificationOptions = {}
): void {
  const platform = opts.platform ?? process.platform;
  const command = buildNotificationCommand(platform, notification, opts.iconPath);
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
