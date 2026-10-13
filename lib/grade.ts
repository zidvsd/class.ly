import { spawn } from "node:child_process";

// This script runs in a separate Node process started with --permission,
// so student code cannot read files, start programs or crash the server.
const RUNNER = `
const vm = require("node:vm");
const { isDeepStrictEqual } = require("node:util");
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const { code, fnName, tests } = JSON.parse(input);
  let passed = 0;
  for (const test of tests) {
    try {
      const printed = [];
      const log = (...values) => printed.push(values.join(" "));
      const context = vm.createContext({ console: { log, info: log }, args: test.args });
      const result = vm.runInContext(code + "\\nJSON.stringify(" + fnName + "(...args))", context, { timeout: 1000 });
      const returned = result === undefined ? undefined : JSON.parse(result);
      // Pass if the function returns the expected value OR prints it (for "print Hello" style questions).
      if (isDeepStrictEqual(returned, test.expected) || printed.includes(String(test.expected))) passed++;
    } catch {}
  }
  process.stdout.write(String(passed));
});`;

// Runs the student's code against the teacher's tests and returns how many passed.
export function runTests(code: string, fnName: string, tests: { args: unknown[]; expected: unknown }[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--permission", "--max-old-space-size=64", "-e", RUNNER], {
      timeout: 2000 + 1000 * tests.length,
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.on("close", () => resolve(Number(output) || 0));
    child.on("error", () => resolve(0));
    child.stdin.end(JSON.stringify({ code, fnName, tests }));
  });
}
