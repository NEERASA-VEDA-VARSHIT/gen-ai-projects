import fs from 'fs';
import path from 'path';
import { redactSensitive } from '@/safety/redactor';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'agent.log');

const colors: Record<LogLevel, string> = {
  INFO: '\x1b[36m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  SUCCESS: '\x1b[32m',
};

const reset = '\x1b[0m';

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatMessage(level: string, message: string): string {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').substring(0, 19);
  return `[${ts}] [${level}] ${message}`;
}

function writeToFile(formatted: string): void {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, formatted + '\n', 'utf-8');
}

export class Logger {
  static logs: string[] = [];

  private static add(level: LogLevel, message: string): void {
    const redacted = redactSensitive(message);
    const formatted = formatMessage(level, redacted);
    Logger.logs.push(formatted);
    console.log(`${colors[level]}${formatted}${reset}`);
    writeToFile(formatted);
  }

  static info(message: string): void {
    Logger.add('INFO', message);
  }

  static warn(message: string): void {
    Logger.add('WARN', message);
  }

  static error(message: string): void {
    Logger.add('ERROR', message);
  }

  static success(message: string): void {
    Logger.add('SUCCESS', message);
  }

  static separator(): void {
    const line = '\u2500'.repeat(60);
    Logger.logs.push(line);
    console.log(`\x1b[90m${line}\x1b[0m`);
    writeToFile(line);
  }

  static clearLog(): void {
    Logger.logs = [];
    ensureLogDir();
    fs.writeFileSync(LOG_FILE, '', 'utf-8');
  }

  static getLogs(): string[] {
    return [...Logger.logs];
  }
}
