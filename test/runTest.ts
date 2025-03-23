import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Ensure all required directories exist
const resultsDir = path.resolve(__dirname, "./results");
const fixturesResultsDir = path.resolve(__dirname, "./fixtures/results");

[resultsDir, fixturesResultsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log("=== Running import parser tests ===");
console.log("Date: " + new Date().toLocaleString());
console.log("");

interface TestResult {
  success: boolean;
  output: string;
  error?: string;
}

function runTest(testFile: string, description: string): TestResult {
  console.log(`\n=== Running ${description} ===`);
  console.log(`File: ${testFile}`);
  console.log("");

  try {
    const output = execSync(`npx ts-node ${testFile}`, { encoding: "utf-8" });
    console.log(output);
    return { success: true, output };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error while running ${testFile}:`);
    console.error(errorMessage);
    return { success: false, output: "", error: errorMessage };
  }
}

// Run tests and collect results
const tests = [
  { file: "./fixtures/test.ts", description: "standard tests" },
  { file: "./fixtures/error-test.ts", description: "specific error tests" }
];

const testResults = tests.map(test => ({
  ...test,
  result: runTest(path.resolve(__dirname, test.file), test.description)
}));

// Generate test summary
console.log("\n=== Test Summary ===");
testResults.forEach(test => {
  console.log(`${test.description}: ${test.result.success ? "✅ SUCCESS" : "❌ FAILURE"}`);
});

const allTestsPassed = testResults.every(test => test.result.success);
console.log(`Overall result: ${allTestsPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);

// Write test report
const timestamp = Date.now();
const reportPath = path.resolve(__dirname, `./results/test-report-${timestamp}.json`);

fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      timestamp,
      date: new Date().toISOString(),
      results: testResults.reduce((acc, test) => ({
        ...acc,
        [test.description.replace(/\s/g, "")]: {
          success: test.result.success,
          error: test.result.error
        }
      }), {}),
      allTestsPassed
    },
    null,
    2
  )
);

console.log(`\nTest report written to: ${reportPath}`);

process.exit(allTestsPassed ? 0 : 1);
