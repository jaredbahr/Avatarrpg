import { CONTENT } from './src/content';
import { runBalanceReport, partyOfSize } from './src/core/sim/balance';
import type { ContentIndex } from './src/core/types';

const noProps: ContentIndex = (() => {
  const map = CONTENT.maps.get('quarry_gate')!;
  const maps = new Map(CONTENT.maps);
  maps.set('quarry_gate', { ...map, props: [] });
  return { ...CONTENT, maps };
})();

console.log('Quarry gate, 200 trials, props vs the pre-change map:\n');
console.log('size   with props   without props');
for (const size of [4, 5]) {
  const w = runBalanceReport(CONTENT, { trials: 200, party: partyOfSize(size) })
    .encounters.find((e) => e.encounterId === 'enc_quarry_gate')!;
  const wo = runBalanceReport(noProps, { trials: 200, party: partyOfSize(size) })
    .encounters.find((e) => e.encounterId === 'enc_quarry_gate')!;
  console.log(`  ${size}     ${(w.winRate * 100).toFixed(1).padStart(6)}%        ${(wo.winRate * 100).toFixed(1).padStart(6)}%`);
}
