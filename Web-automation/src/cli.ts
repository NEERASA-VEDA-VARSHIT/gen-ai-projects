import { BrowserAgent } from '@/agent/browser-agent';
import { Logger } from '@/logger/logger';
import { validateAndSanitize, GuardError } from '@/safety/input-guard';
import { sanitizeErrorMessage } from '@/safety/redactor';
import { InputJudge, JudgeTripwireError } from '@/safety/judge-guard';

const DEFAULT_TASK = 'Find the Name and Description form fields on the page and fill them with test values.';
const DEFAULT_URL = 'https://ui.shadcn.com/docs/forms/react-hook-form';

function parseArgs(): { task: string; url: string } {
  const args = process.argv.slice(2);
  let task = DEFAULT_TASK;
  let url = DEFAULT_URL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      task = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log(`
Website Automation Agent - CLI

Usage:
  npm run agent [options]

Options:
  --task <text>    Task description (default: auto-detect and fill form fields)
  --url  <url>     Target URL (default: shadcn react-hook-form docs)
  --help           Show this help

Examples:
  npm run agent
  npm run agent -- --url https://example.com/form
  npm run agent -- --task "Fill the registration form" --url https://example.com/signup
`);
      process.exit(0);
    }
  }

  return { task, url };
}

async function main(): Promise<void> {
  const { task, url } = parseArgs();

  const validated = validateAndSanitize(task, url);

  console.log('');
  console.log('\x1b[35m%s\x1b[0m', '  ╔══════════════════════════════════════════════╗');
  console.log('\x1b[35m%s\x1b[0m', '  ║      WEBSITE AUTOMATION AGENT v1.0           ║');
  console.log('\x1b[35m%s\x1b[0m', '  ╚══════════════════════════════════════════════╝');
  console.log('');

  try {
    const judge = await InputJudge.create();
    await judge.guard(validated.task);
    Logger.info('Input judge: ALLOW');
  } catch (error) {
    if (error instanceof JudgeTripwireError) {
      Logger.error(`Input judge: BLOCKED — ${error.message}`);
      console.log(`\n\x1b[31mInput blocked by safety judge: ${error.message}\x1b[0m\n`);
      process.exit(1);
    }
    Logger.warn(`Judge unavailable, proceeding: ${String(error)}`);
  }

  const agent = new BrowserAgent();
  const result = await agent.run(validated.task, validated.url);

  Logger.separator();
  console.log('\n\x1b[36m%s\x1b[0m', '  ╔══════════════════════════════════════════════╗');
  console.log(`\x1b[36m%s\x1b[0m`, `  ║  Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}${' '.repeat(25 - (result.success ? 10 : 9))}║`);
  console.log('\x1b[36m%s\x1b[0m', '  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Actions completed: ${result.completedActions}`);
  console.log(`  Errors:            ${result.errors.length}`);
  console.log(`  Screenshots:       ${result.screenshots.length}`);
  if (result.errors.length > 0) {
    console.log('');
    console.log('  Errors:');
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }
  console.log('');

  if (result.screenshots.length > 0) {
    console.log('  Screenshots saved:');
    result.screenshots.forEach((s) => console.log(`    screenshots/${s}.png`));
  }

  console.log('');
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  if (err instanceof GuardError) {
    console.error(`\x1b[31mInput validation failed: ${err.message}\x1b[0m`);
  } else {
    console.error(`\x1b[31mFatal error: ${sanitizeErrorMessage(err)}\x1b[0m`);
  }
  process.exit(1);
});
