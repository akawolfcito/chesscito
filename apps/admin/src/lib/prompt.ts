/** Prompt helpers for interactive CLI input.
 *
 *  - `confirm`: visible y/N prompt for harmless boolean checks.
 *  - `promptHidden`: no-echo input for passwords and private keys.
 *    Uses raw mode so each keypress is intercepted before the terminal
 *    can echo it. Backspace edits in place; Ctrl-C exits cleanly. */
import { createInterface } from "node:readline";

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

export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buffer = "";
    const onData = (raw: string) => {
      // raw can be a multi-char string when the user pastes; iterate.
      for (const char of raw) {
        switch (char) {
          case "\n":
          case "\r": {
            stdin.setRawMode?.(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(buffer);
            return;
          }
          case "\u0003": {
            // Ctrl-C — exit gracefully, do not return a partial buffer.
            stdin.setRawMode?.(false);
            stdin.pause();
            stdout.write("\n");
            process.exit(130);
            return;
          }
          case "\u0004": {
            // Ctrl-D — EOF, treat as enter on whatever was typed.
            stdin.setRawMode?.(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(buffer);
            return;
          }
          case "\u007f":
          case "\b": {
            buffer = buffer.slice(0, -1);
            break;
          }
          default: {
            if (char >= " ") buffer += char;
          }
        }
      }
    };
    stdin.on("data", onData);
  });
}
