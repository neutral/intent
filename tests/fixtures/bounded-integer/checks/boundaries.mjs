// Run directly in the implementation area after reading the Check definition.
const findings = [];
let outcome = 'pass';
try {
  const { parseInteger } = await import('../src/parse-integer.mjs');
  if (typeof parseInteger !== 'function') throw new Error('Missing parseInteger export');
  const valid = [['0', 0], ['1', 1], ['9', 9], ['10', 10], ['99', 99], ['100', 100], ['998', 998], ['999', 999]];
  const invalid = ['', '00', '01', '-1', '+1', '1.0', '1e2', ' 1', '1 ', '1\n', '1000', '１２', '١', '9'.repeat(10000)];
  const cases = [
    ...valid.map(([token, expected]) => ({ label: JSON.stringify(token), run: () => Object.is(parseInteger(token), expected) })),
    ...invalid.map(token => ({ label: token.length > 30 ? '10000-digit token' : JSON.stringify(token), run: () => { try { parseInteger(token); } catch (error) { return error instanceof RangeError; } return false; } })),
    ...[null, undefined, 1, {}, ['1']].map(token => ({ label: `non-string ${String(token)}`, run: () => { try { parseInteger(token); } catch (error) { return error instanceof TypeError; } return false; } })),
  ];
  for (const item of cases) {
    let passed = false;
    try { passed = item.run(); } catch { /* A wrong thrown error also contradicts the case. */ }
    if (!passed) outcome = 'fail';
    findings.push({ message: `${passed ? 'PASS' : 'FAIL'} ${item.label}` });
  }
} catch (error) {
  outcome = 'fail';
  findings.push({ message: `The supplied module could not provide the parser: ${String(error.message).slice(0, 1000)}` });
}
// This is an ordinary implementation report. Intent does not consume it.
process.stdout.write(JSON.stringify({
  check: 'check.integer-boundaries', outcome, findings,
  limitations: [`Node.js ${process.versions.node}; 27 fixed boundary/type cases, no exhaustive proof or timing measurement.`],
}, null, 2) + '\n');
process.exitCode = outcome === 'pass' ? 0 : 1;
