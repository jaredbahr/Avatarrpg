import type { StoryNode } from '../../core/types';
import { CHARACTER_BY_ID } from '../characters';

/** Separate encounters give companions room to contribute without competing for one line. */
export const VOICES = [
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
      'Their families can stay with them. We will need a few extra chairs.',
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
      "I've carried post up those switchbacks. Two hours. Allow longer when the steps are muddy.",
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
      "Hear them in the galleries? They're calling him Grumbler. I've repaired drives like his; he's running it on a split oil hose.",
      'There is oil under the treads. Keep a route back to the ramp; we still have people to bring out.',
    ],
  },
  {
    node: 'defeat_forest',
    character: 'tenzo',
    lines: [
      'They took the food. I packed enough for a second party, and even the pickled radish is gone. It needed three more days.',
      "They left the wrapping in my pocket. Nothing's broken. Give me a moment, then I'm following their tracks uphill.",
    ],
  },
  {
    node: 'forest_dema_again',
    character: 'sura',
    lines: [
      'Is this stream any good for fishing, Dema? Back home I pulled one through the ice as long as your washing line.',
      'Half your washing line. Nothing will bite in water this white, though. Somebody up at that quarry owes you an answer about the runoff.',
    ],
  },
  {
    node: 'defeat_gate',
    character: 'riko',
    lines: [
      'All the way down the switchbacks under their stones, and I kept us in one line. Nobody fell behind.',
      'Nobody followed. Now the gate is open and the wall is empty. Ruon is waiting in the yard, laying his sabre down.',
    ],
  },
  {
    node: 'defeat_gate',
    character: 'kaya',
    lines: [
      "I came down those switchbacks a lot faster than I went up. I'd like it noted that I was first back up, too.",
      "The gate's open. Nobody on the wall. Ruon is in the yard, and he's putting his sabre on the ground.",
    ],
  },
  {
    node: 'gate_kinship',
    character: 'lin_mei',
    lines: [
      'Ruon, there are fresh falls on the east face. Old supports under a face like that get replaced before anyone works beneath it.',
      'Who was told about them? No, lower the slings and open the gate first. You can tell me in the yard.',
    ],
  },
  {
    node: 'defeat_ambush',
    character: 'nilak',
    lines: [
      'Ruon, sit. You found that gap and hauled me over the scree. Let me listen to your breathing.',
      "They lost us below the cutting. We have a little time. Breathe slowly; I'm not going anywhere.",
    ],
  },
  {
    node: 'defeat_ambush',
    character: 'jinu',
    lines: [
      "I know this cutting. There's a goat track past a split boulder, comes out by a well... No. That one is two provinces north.",
      "Ruon found the right gap, anyway. We've lost them below. Get your breath back, Ruon; I'll watch the path.",
    ],
  },
  {
    node: 'cutting_tea_again',
    character: 'nima',
    lines: [
      'Is there a cloth? ... Found it under the bench. If I bundle all the cups up in it, I can dry them in one go.',
      "Nearly all of them. Here's the blue one's handle. It was in the bundle.",
    ],
  },
  {
    node: 'quarry_assessment',
    character: 'bo',
    lines: [
      'Hear that? They\'re shouting "Grumbler!" The driver knows every one of those voices.',
      "Nobody parks anything on that ramp. Everyone in those galleries comes out that way, and I'll be counting heads when they do.",
    ],
  },
  {
    node: 'defeat_boss',
    character: 'wen',
    lines: [
      'I planned for the treads and the hose. Not for him parking the whole thing across the ramp. So: the loose stone.',
      "The drill's still going down there. Mira's coming up the switchback with Dorin and a handcart. She's going to tell me to sit.",
    ],
  },
] as const;

/**
 * Authored variants only; the existing condition evaluator handles presence and consciousness.
 * A node may carry several voices. The first one listed whose hero is present speaks, so a
 * hero's own moment stays theirs and a later voice covers a party without them.
 */
export function withPartyVoices(nodes: readonly StoryNode[]): readonly StoryNode[] {
  return nodes.map((node): StoryNode => {
    const voices = VOICES.filter((candidate) => candidate.node === node.id);
    if (voices.length === 0) return node;
    if (node.kind !== 'dialogue') throw new Error(`Party voice needs dialogue: ${node.id}`);
    return {
      ...node,
      variants: [
        ...voices.map((voice) => {
          const character = CHARACTER_BY_ID.get(voice.character);
          if (!character) throw new Error(`Unknown party speaker: ${voice.character}`);
          return {
            when: {
              kind: 'all' as const,
              of: [
                { kind: 'partyHas' as const, characterId: character.id },
                { kind: 'flag' as const, key: 'act1_complete', op: 'unset' as const },
              ],
            },
            speaker: character.name,
            portrait: character.portrait,
            lines: voice.lines,
          };
        }),
        ...(node.variants ?? []),
      ],
    };
  });
}
