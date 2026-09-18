import type { StoryNode } from '../../core/types';
import { CHARACTER_BY_ID } from '../characters';

/** Separate encounters give companions room to contribute without competing for one line. */
const VOICES = [
  {
    node: 'cutting_tea',
    character: 'tenzo',
    lines: [
      'That bench is quarry offcut. Someone hauled it up here just to have a seat.',
      "Sen, keep the kettle on. When we bring the crews through, I'll help you feed them.",
      "I'll wash these cups first. That blue handle looks loose; does it come off?",
    ],
  },
  {
    node: 'riverside_mira',
    character: 'nilak',
    lines: [
      'Mira, is there a room we can use when the workers come home? Somewhere with a table and clean water.',
      "Set aside some cloth, too. I'll check on anyone who needs help before they go back to their families.",
      'Tell them where to find me. They do not need papers or a sponsor.',
    ],
  },
  {
    node: 'discover_runoff_marker',
    character: 'sura',
    lines: [
      "That's quarry grit. I've had nets come up full of it near a stone yard.",
      "The scratch here says the settling pit may be blocked. I'd ask there before digging up this bank.",
      'The lower reeds are coated in it. The turtle-ducks will need somewhere else to nest.',
    ],
  },
  {
    node: 'gate_kinship',
    character: 'bo',
    lines: [
      'I ran a crew three towns over. We stopped work when a gallery cracked. Lost a week of wages over it.',
      'Ruon, those supports need replacing. You cannot keep people down there while that machine is running.',
      'Let us through. You can talk to us yourself. Your crew can put the slings down.',
    ],
  },
  {
    node: 'forest_dema',
    character: 'lin_mei',
    lines: [
      'Dema, the white silt reaches above the reeds. Has it been this high since the rain?',
      'I can mark the bank here and compare it with the stone further up. That will show where the runoff is coming in.',
      'Leave the nest in your washing for now. The old nesting ground is still covered.',
    ],
  },
  {
    node: 'discover_duck_nest',
    character: 'nima',
    lines: [
      "Easy. We're only passing. Nobody wants your sock.",
      'Look at the old nest by the stream. It is full of quarry silt. This one is dry.',
      "We can go round. I'd rather get my boots muddy than send those ducklings back down there.",
    ],
  },
  {
    node: 'dorin_directions',
    character: 'jinu',
    lines: [
      "I've carried post up those switchbacks. Two hours, unless the mud has taken the steps again.",
      'Dorin, stay at the village gate. If we send anyone down ahead of us, they will need someone watching for them.',
      "If we find anyone who can walk, I'll send them straight to you.",
    ],
  },
  {
    node: 'escort_chosen',
    character: 'riko',
    lines: [
      'Ruon, you are coming back to Ba Dan. Stay where I can see you.',
      'If Jin has people on the road, tell us where they will be waiting. I want a way out before they reach us.',
      'You can have your sabre if they attack. Afterwards, you hand it back. Agreed?',
    ],
  },
  {
    node: 'quarry_assessment',
    character: 'wen',
    lines: [
      "I've repaired drives like that. He's running it with a split oil hose.",
      'There is oil under the treads. Keep a route back to the ramp; we still have people to bring out.',
    ],
  },
] as const;

/** Authored variants only; the existing condition evaluator handles presence and consciousness. */
export function withPartyVoices(nodes: readonly StoryNode[]): readonly StoryNode[] {
  return nodes.map((node): StoryNode => {
    const voice = VOICES.find((candidate) => candidate.node === node.id);
    if (!voice) return node;
    if (node.kind !== 'dialogue') throw new Error(`Party voice needs dialogue: ${node.id}`);
    const character = CHARACTER_BY_ID.get(voice.character);
    if (!character) throw new Error(`Unknown party speaker: ${voice.character}`);
    return {
      ...node,
      variants: [
        {
          when: {
            kind: 'all',
            of: [
              { kind: 'partyHas', characterId: character.id },
              { kind: 'flag', key: 'act1_complete', op: 'unset' },
            ],
          },
          speaker: character.name,
          portrait: character.portrait,
          lines: voice.lines,
        },
        ...(node.variants ?? []),
      ],
    };
  });
}
