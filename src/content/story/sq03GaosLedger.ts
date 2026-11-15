/**
 * SQ-03, Gao's Other Ledger (story bible Part 06, "Ba Dan and the quarry").
 *
 * Gao asks the party to carry two parcels past the canal and not to take any money. Nobody is
 * charged, his storeroom shelves are bare, an overdue wholesale invoice sits under the scale,
 * and the drawer under the counter is full of slips that are never crossed out: since the carts
 * stopped, Gao has been quietly carrying his neighbours' debts. The choice is recorded in
 * `sq03.ledger`:
 *
 * - `extension`: help him write to the wholesaler for more time, with only his name on it;
 * - `fund`: ask the neighbours, with his agreement, to keep a shared food jar, with no names;
 * - `praised`: tell the square what he has done, against his wishes. Coins come; trust strains.
 *
 * The return detail, once the workers are home: a new jar on the counter, labelled "For whoever
 * needs it; no speeches." After the Ruon trade, Gao accepts the help for his neighbours and still
 * does not pretend to approve. The bible's finale-shelter comfort is deferred to MQ-12. Nothing
 * here gates the main route, nothing grants XP, and declining asks again next time. It is offered
 * only before the rescue, while the shelves are bare, and only once Gao has given the party his
 * first word: a skipped story is never claimed.
 */

import type { Condition, StoryNode } from '../../core/types';

const GAO = 'Gao the Shopkeeper';
const GAO_FACE = 'portrait.gao';
const SHOP = 'Gao’s shop';
const NARRATOR = 'portrait.narrator';
const LABEL =
  'A new jar stands beside the scale. The label, in Gao’s square hand: “For whoever needs it; no speeches.”';

export const SQ03_FLAG = 'sq03.ledger';
const outcome = (value: 'extension' | 'fund' | 'praised'): Condition => ({
  kind: 'flag',
  key: SQ03_FLAG,
  op: 'eq',
  value,
});
/** The party found Gao's other ledger and chose how to help. */
export const SQ03_RESOLVED: Condition = { kind: 'flag', key: SQ03_FLAG, op: 'set' };
const TRADED: Condition = { kind: 'flag', key: 'ruon_traded', op: 'set' };

export const SQ03_STORY: readonly StoryNode[] = [
  /* --------------------------------------------------------- The hook */
  {
    id: 'sq03_hook',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: [
      'You’re not in a hurry? Good. Two parcels, for the houses past the canal. The blue door, and the one with the bent shutter.',
      'If anybody tries to pay you, don’t take it. They’ve paid.',
      'And if they tell you I’m running short, I’m not. The storeroom is full.',
    ],
    variants: [
      {
        when: TRADED,
        lines: [
          'I haven’t changed my mind about Ruon. This isn’t for you. It’s for the houses past the canal.',
          'Two parcels. The blue door, and the one with the bent shutter. If anybody tries to pay you, don’t take it.',
          'And if they tell you I’m running short, I’m not. The storeroom is full.',
        ],
      },
    ],
    next: 'sq03_ask',
  },
  {
    id: 'sq03_ask',
    kind: 'choice',
    speaker: GAO,
    portrait: GAO_FACE,
    prompt: 'Rice, oil, a twist of salt. He has tied every knot twice.',
    options: [
      { label: 'Carry the parcels', detail: 'Past the canal and back.', next: 'sq03_deliver' },
      // Declining sets nothing: Gao says what he would have said, and asks again next time.
      { label: 'Another time', detail: 'Talk with Gao instead.', next: 'plant_chair_decline' },
    ],
  },
  {
    id: 'sq03_deliver',
    kind: 'dialogue',
    speaker: 'Past the canal',
    portrait: NARRATOR,
    lines: [
      'At the blue door, an old man takes his parcel and starts counting coins out of a cup. You tell him Gao said it’s paid. He stops counting.',
      'At the bent shutter, a woman with flour on her arms says, “Paid? I haven’t paid since spring.” Then she shuts the door rather quickly.',
      'On the way back you pass the storeroom. Its door is open. Most of the shelves are bare.',
    ],
    next: 'sq03_counter',
  },
  {
    id: 'sq03_counter',
    kind: 'dialogue',
    speaker: SHOP,
    portrait: NARRATOR,
    lines: [
      'An invoice is pinned under the scale weight. “Valley Wholesale. SECOND NOTICE. Rice, oil, salt.” The total is circled twice.',
      'The drawer under the counter is half open. It is full of slips, each with a name and a sum. None of them is crossed out.',
    ],
    next: 'sq03_truth',
  },
  {
    id: 'sq03_truth',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: [
      'No, they weren’t charged. Shut that drawer, please. It isn’t yours.',
      'Since the carts stopped, nobody’s had wages. You don’t stop selling rice because people stopped being paid.',
      'So I pay the wholesaler, and when I can’t, I write it down. Those slips are so I remember who to look in on.',
      'It’s their business that they needed it. Not the square’s.',
    ],
    next: 'sq03_choice',
  },
  {
    id: 'sq03_choice',
    kind: 'choice',
    speaker: GAO,
    portrait: GAO_FACE,
    prompt: 'Well? You’re still standing there.',
    options: [
      {
        label: 'Write to the wholesaler together',
        detail: 'Ask Valley Wholesale for more time. Quiet, with only Gao’s name on it.',
        next: 'sq03_extension',
        setFlags: { [SQ03_FLAG]: 'extension' },
      },
      {
        label: 'Ask the neighbours about a food jar',
        detail: 'A jar anyone can put into or take from, if Gao agrees. No names.',
        next: 'sq03_fund',
        setFlags: { [SQ03_FLAG]: 'fund' },
      },
      {
        label: 'Tell the square what Gao has done',
        detail: 'People will give. Gao asked you not to, and the families he helped will be known.',
        next: 'sq03_praised',
        setFlags: { [SQ03_FLAG]: 'praised' },
      },
    ],
  },

  /* ----------------------------------------------------------- The choice */
  {
    id: 'sq03_extension',
    kind: 'dialogue',
    speaker: SHOP,
    portrait: NARRATOR,
    lines: [
      'Gao finds paper. You find the words, and he crosses half of them out. “Respectfully” survives. “Desperate” does not.',
      'He signs it, folds it twice, and puts it in his apron to send with the next carrier.',
    ],
    next: 'sq03_extension_after',
  },
  {
    id: 'sq03_extension_after',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: ['If they say no, they say no.', 'Thank you. Don’t make that face. I said it once.'],
    next: 'village_leave',
  },
  {
    id: 'sq03_fund',
    kind: 'dialogue',
    speaker: 'Around the square',
    portrait: NARRATOR,
    lines: [
      'You knock on doors and don’t say why. You ask whether people would put a little in a jar at Gao’s, and take from it when they need to.',
      'The woman with flour on her arms brings a cup of rice. The old man from the blue door brings a mended basket and asks whether that counts.',
    ],
    next: 'sq03_fund_after',
  },
  {
    id: 'sq03_fund_after',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: [
      'The basket counts.',
      'Fine. One jar. No names on anything. And nobody makes a speech about it.',
    ],
    next: 'village_leave',
  },
  {
    id: 'sq03_praised',
    kind: 'dialogue',
    speaker: 'Mira’s table',
    portrait: NARRATOR,
    lines: [
      'You stand by Mira’s table and tell the square about Gao’s drawer. People clap. Coins come out of pockets.',
      'Gao doesn’t clap. Across the canal, the bent shutter closes.',
    ],
    next: 'sq03_praised_after',
  },
  {
    id: 'sq03_praised_after',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: ['They gave. You were right about that.', 'Next time, ask me first.'],
    next: 'village_leave',
  },

  /* ----------------------------------------------- The return detail */
  {
    // Once the workers are home and Gao's homecoming is heard.
    id: 'sq03_jar',
    kind: 'dialogue',
    speaker: GAO,
    portrait: GAO_FACE,
    lines: [
      'Valley Wholesale gave me until harvest. Polite letter. Somebody wrote it well.',
      'People keep asking what they can do. I told them: there’s a jar.',
    ],
    variants: [
      {
        when: TRADED,
        lines: [
          'The jar’s doing its job. That’s for them. It isn’t for what happened with Ruon.',
          'I haven’t changed my mind about that. Read the label.',
        ],
      },
      {
        when: outcome('fund'),
        lines: [
          'Half full again. Somebody put in a whole sack of beans and didn’t say who.',
          'I know who.',
        ],
      },
      {
        when: outcome('praised'),
        lines: [
          'The square was generous. I’ll say that. Two families haven’t been in since.',
          'So I made a jar. Read the label.',
        ],
      },
    ],
    next: 'sq03_jar_label',
  },
  {
    id: 'sq03_jar_label',
    kind: 'dialogue',
    speaker: SHOP,
    portrait: NARRATOR,
    lines: [LABEL],
    variants: [
      {
        when: outcome('fund'),
        lines: [LABEL, 'There is a mended basket under it. It is full of turnips.'],
      },
    ],
    next: 'village_leave',
  },
];
