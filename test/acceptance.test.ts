import { initDatabase } from '../server/db.ts';
import { runAllAcceptanceScenarios } from '../server/routes/acceptanceTest.ts';

console.log('===========================================================');
console.log('  6C DISTRIBUTION MANAGEMENT - SUITE DE TESTS D\'ACCEPTATION');
console.log('===========================================================\n');

initDatabase();

const { passed, results, summary } = runAllAcceptanceScenarios();

results.forEach((r) => {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} SCÉNARIO ${r.scenarioNumber}: ${r.title}`);
  console.log(`   ${r.details}`);
  r.logs.forEach((log) => console.log(`      ${log}`));
  console.log('');
});

console.log('-----------------------------------------------------------');
console.log(`RÉSULTAT GLOBAL: ${passed ? 'SUCCÈS TOTAL' : 'ÉCHEC'}`);
console.log(`Bilan: ${summary}`);
console.log('===========================================================');

if (!passed) {
  process.exit(1);
} else {
  process.exit(0);
}
