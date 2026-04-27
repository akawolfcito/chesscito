import { createInterface } from "node:readline";

/** Tiny y/N prompt for interactive confirmation. Returns true on the
 *  empty default-N case being declined ("n", "no", "") and true on
 *  any input that starts with `y`. Used by the write-command
 *  orchestrator to gate cast send behind a human acknowledgement. */
export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} [y/N] `, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
