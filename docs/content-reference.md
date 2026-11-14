# Content reference

> Generated from `src/content/` by `npm run docs:content`. Do not edit by hand.

Names are shown in authored content order within each entry; sections and records are sorted by name. Encounter XP totals cover the listed roster only. Conditional enemies, allied placements, and reinforcements are listed separately and do not affect the authored-roster comparison.

## Characters

### Bo

- Element: earth
- Kit: 1: Rock Throw; 2: Stone Stance; 3: choose Earth Wall / Shockwave; 5: specialize Earth Shaping / Metalbending

### Jinu

- Element: air
- Kit: 1: Air Blast; 2: Gust; 3: choose Air Shield / Air Scooter; 5: specialize Air Shaping / Sound Bending

### Kaya

- Element: fire
- Kit: 1: Fire Jab; 2: Flame Arc; 3: choose Fire Blast / Fire Step; 5: specialize Flame Shaping / Lightning

### Lin Mei

- Element: earth
- Kit: 1: Rock Throw; 2: Shockwave; 3: choose Earth Wall / Raise Rubble; 5: specialize Earth Shaping / Metalbending

### Nilak

- Element: water
- Kit: 1: Water Whip; 2: Healing Stream; 3: choose Water Pull / Ice Path; 5: specialize Ice Shaping / Healing

### Nima

- Element: air
- Kit: 1: Air Blast; 2: Air Scooter; 3: choose Air Shield / Gust; 5: specialize Air Shaping / Sound Bending

### Riko

- Element: nonbender
- Kit: 1: Strike; 2: Chi Block; 3: choose Take Cover / Bolas; 5: specialize Field Craft / Engineering

### Sura

- Element: water
- Kit: 1: Water Whip; 2: Ice Path; 3: choose Healing Stream / Water Pull; 5: specialize Ice Shaping / Healing

### Tenzo

- Element: fire
- Kit: 1: Fire Jab; 2: Fire Blast; 3: choose Fire Step / Flame Arc; 5: specialize Flame Shaping / Lightning

### Wen

- Element: nonbender
- Kit: 1: Strike; 2: Gauntlet Spark; 3: choose Take Cover / Bolas; 5: specialize Field Craft / Engineering

## Disciplines

### Air Shaping

- Element: air
- Availability: always available
- Abilities: 5: Cyclone; 7: Air Cushion; 10: Tornado

### Earth Shaping

- Element: earth
- Availability: always available
- Abilities: 5: Mudslide; 7: choose Seismic Sense / Boulder; 10: Fissure

### Engineering

- Element: nonbender
- Availability: you have learned engineering
- Abilities: 5: Electrified Glove; 7: Shock Mine; 10: Disruptor Array

### Field Craft

- Element: nonbender
- Availability: always available
- Abilities: 5: Smoke Bomb; 7: choose Shield Bash / Rally; 10: Pressure Points

### Flame Shaping

- Element: fire
- Availability: always available
- Abilities: 5: Fire Wall; 7: Heat Shield; 10: Dragon Breath

### Healing

- Element: water
- Availability: you have learned healing
- Abilities: 5: Healing Hands; 7: Purifying Mist; 10: Life Tide

### Ice Shaping

- Element: water
- Availability: always available
- Abilities: 5: Ice Spikes; 7: choose Tidal Wave / Ice Shield; 10: Octopus Form

### Lightning

- Element: fire
- Availability: you have learned lightning
- Abilities: 5: Lightning; 7: Lightning Arc; 10: Lightning Storm

### Metalbending

- Element: earth
- Availability: you have learned metalbending
- Abilities: 5: Metal Cable; 7: Metal Armor; 10: Metalbending

### Sound Bending

- Element: air
- Availability: you have learned soundbending
- Abilities: 5: Sonic Boom; 7: Deafening Shout; 10: Shatterpoint

## Abilities

| Ability           | Owner                                                          |  AP | Range | Targeting       | Line of sight | Effects                                                                                                                                                        |       Cooldown | Status or surface   |
| ----------------- | -------------------------------------------------------------- | --: | ----- | --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------: | ------------------- |
| Air Blast         | Character: Jinu, Character: Nima                               |   1 | 6     | unit (enemy)    | yes           | air damage 3 + 0.5× power; push 2 tiles                                                                                                                        | 0 (every turn) | —                   |
| Air Cushion       | Discipline: Air Shaping                                        |   2 | 5     | unit (ally)     | yes           | healing 4 + 0.3× focus; guarded for 1 round (100%, to hit); grant 1 AP to hit                                                                                  |              2 | guarded             |
| Air Scooter       | Character: Jinu, Character: Nima                               |   1 | 6     | tile            | no            | dash                                                                                                                                                           |              2 | —                   |
| Air Shield        | Character: Jinu, Character: Nima                               |   1 | 0     | self            | yes           | guarded for 1 round (100%, to self); cleanse burning                                                                                                           |              2 | guarded             |
| Bark an Order     | Enemy: Captain Ruon                                            |   1 | 6     | unit (ally)     | yes           | inspired for 2 rounds (100%, to hit)                                                                                                                           |              2 | inspired            |
| Bolas             | Character: Riko, Character: Wen                                |   2 | 6     | unit (enemy)    | yes           | physical damage 3 + 0.3× power; rooted for 2 rounds (85%, to hit)                                                                                              |              2 | rooted              |
| Boulder           | Discipline: Earth Shaping                                      |   3 | 7     | blast, radius 1 | yes           | earth damage 9 + 0.9× power; rubble surface (area, permanent)                                                                                                  |              3 | rubble              |
| Captain’s Sabre   | Enemy: Captain Ruon                                            |   2 | 1     | unit (enemy)    | yes           | physical damage 7 + 0.8× power                                                                                                                                 | 0 (every turn) | —                   |
| Chi Block         | Character: Riko                                                |   2 | 1     | unit (enemy)    | yes           | physical damage 3 + 0.4× power (ignores defense); chiBlocked for 2 rounds (80%, to hit)                                                                        |              2 | chiBlocked          |
| Churn the Ground  | Enemy: The Driller                                             |   3 | 4     | blast, radius 2 | yes           | mud surface (area, 4 rounds); rooted for 2 rounds (50%, to hit)                                                                                                |              3 | mud, rooted         |
| Club Swing        | Enemy: Quarry Hauler, Enemy: Quarry Worker                     |   2 | 1     | unit (enemy)    | yes           | physical damage 5 + 0.6× power                                                                                                                                 | 0 (every turn) | —                   |
| Crossbow          | Enemy: Mercenary Crossbow                                      |   2 | 8     | unit (enemy)    | yes           | physical damage 6 + 0.6× power                                                                                                                                 |              1 | —                   |
| Cyclone           | Discipline: Air Shaping                                        |   3 | 6     | blast, radius 2 | yes           | air damage 6 + 0.7× power; pull 2 tiles; slowed for 2 rounds (60%, to hit)                                                                                     |              3 | slowed              |
| Deafening Shout   | Discipline: Sound Bending                                      |   2 | 3     | cone, length 3  | yes           | air damage 7 + 0.6× power; slowed for 2 rounds (80%, to hit); stunned for 1 round (35%, to hit)                                                                |              3 | slowed, stunned     |
| Debris Throw      | Enemy: The Driller                                             |   2 | 7     | blast, radius 1 | yes           | earth damage 6 + 0.6× power; rubble surface (center, permanent)                                                                                                |              2 | rubble              |
| Disruptor Array   | Discipline: Engineering                                        |   3 | 5     | blast, radius 2 | yes           | lightning damage 9 + 0.7× power; chiBlocked for 2 rounds (70%, to hit); shocked for 2 rounds (60%, to hit)                                                     |              5 | chiBlocked, shocked |
| Dragon Breath     | Discipline: Flame Shaping                                      |   3 | 5     | cone, length 4  | yes           | fire damage 10 + 0.9× power; burning for 3 rounds (100%, to hit); fire surface (area, 2 rounds)                                                                |              4 | burning, fire       |
| Driller Slam      | Enemy: The Driller                                             |   2 | 2     | cone, length 2  | yes           | earth damage 8 + 0.7× power; push 1 tile                                                                                                                       |              1 | —                   |
| Earth Wall        | Character: Bo, Character: Lin Mei                              |   2 | 5     | line, length 3  | yes           | wall for 3 rounds                                                                                                                                              |              3 | —                   |
| Electrified Glove | Discipline: Engineering                                        |   2 | 1     | unit (enemy)    | yes           | lightning damage 7 + 0.8× power; shocked for 2 rounds (70%, to hit)                                                                                            |              2 | shocked             |
| Fire Blast        | Character: Kaya, Character: Tenzo, Enemy: Fire Nation Deserter |   2 | 6     | blast, radius 1 | yes           | fire damage 6 + 0.7× power; burning for 2 rounds (40%, to hit)                                                                                                 | 0 (every turn) | burning             |
| Fire Jab          | Character: Kaya, Character: Tenzo                              |   1 | 5     | unit (enemy)    | yes           | fire damage 4 + 0.7× power                                                                                                                                     | 0 (every turn) | —                   |
| Fire Step         | Character: Kaya, Character: Tenzo                              |   1 | 4     | tile            | yes           | dash; fire surface (center, 2 rounds)                                                                                                                          |              2 | fire                |
| Fire Wall         | Discipline: Flame Shaping                                      |   3 | 6     | line, length 3  | yes           | fire surface (area, 3 rounds)                                                                                                                                  |              3 | fire                |
| Fissure           | Discipline: Earth Shaping                                      |   3 | 6     | line, length 4  | yes           | earth damage 12 + 1× power; rooted for 2 rounds (90%, to hit); rubble surface (area, permanent)                                                                |              4 | rooted, rubble      |
| Flame Arc         | Character: Kaya, Character: Tenzo                              |   2 | 4     | cone, length 3  | yes           | fire damage 5 + 0.6× power; burning for 2 rounds (50%, to hit)                                                                                                 | 0 (every turn) | burning             |
| Gauntlet Spark    | Character: Wen                                                 |   1 | 1     | unit (enemy)    | yes           | lightning damage 4 + 0.5× power; shocked for 1 round (35%, to hit)                                                                                             |              1 | shocked             |
| Gust              | Character: Jinu, Character: Nima                               |   2 | 4     | cone, length 3  | yes           | air damage 4 + 0.5× power; push 1 tile; blinded for 2 rounds (40%, to hit)                                                                                     | 0 (every turn) | blinded             |
| Healing Hands     | Discipline: Healing                                            |   2 | 1     | unit (ally)     | yes           | healing 14 + 1× focus; cleanse burning, chilled, blinded                                                                                                       |              1 | —                   |
| Healing Stream    | Character: Nilak, Character: Sura                              |   2 | 4     | unit (ally)     | yes           | healing 8 + 0.8× focus; cleanse burning, blinded                                                                                                               |              1 | —                   |
| Heat Shield       | Discipline: Flame Shaping                                      |   2 | 0     | self            | yes           | guarded for 2 rounds (100%, to self); cleanse burning, chilled, frozen                                                                                         |              3 | guarded             |
| Ice Path          | Character: Nilak, Character: Sura                              |   2 | 5     | line, length 4  | yes           | ice surface (area, 3 rounds)                                                                                                                                   |              2 | ice                 |
| Ice Shield        | Discipline: Ice Shaping                                        |   2 | 4     | unit (ally)     | yes           | guarded for 2 rounds (100%, to hit); healing 3 + 0.2× focus                                                                                                    |              3 | guarded             |
| Ice Spikes        | Discipline: Ice Shaping                                        |   2 | 6     | blast, radius 1 | yes           | cold damage 6 + 0.7× power; chilled for 2 rounds (70%, to hit); ice surface (area, 2 rounds)                                                                   |              2 | chilled, ice        |
| Life Tide         | Discipline: Healing                                            |   3 | 6     | blast, radius 2 | yes           | healing 18 + 1.2× focus; cleanse burning, wet, chilled, frozen, shocked, stunned, slowed, blinded, rooted, chiBlocked; inspired for 2 rounds (100%, to allies) |              5 | inspired            |
| Lightning         | Discipline: Lightning                                          |   3 | 8     | unit (enemy)    | yes           | lightning damage 9 + 1.1× power; shocked for 2 rounds (60%, to hit)                                                                                            |              3 | shocked             |
| Lightning Arc     | Discipline: Lightning                                          |   2 | 6     | line, length 5  | yes           | lightning damage 8 + 0.8× power; shocked for 2 rounds (60%, to hit)                                                                                            |              3 | shocked             |
| Lightning Storm   | Discipline: Lightning                                          |   3 | 8     | blast, radius 2 | yes           | lightning damage 12 + 1× power; shocked for 3 rounds (80%, to hit); stunned for 1 round (30%, to hit)                                                          |              5 | shocked, stunned    |
| Mercenary Blade   | Enemy: Mercenary, Enemy: Mercenary Sergeant                    |   2 | 1     | unit (enemy)    | yes           | physical damage 7 + 0.7× power; slowed for 1 round (30%, to hit)                                                                                               | 0 (every turn) | slowed              |
| Metal Armor       | Discipline: Metalbending                                       |   2 | 0     | self            | yes           | guarded for 3 rounds (100%, to self); cleanse rooted, slowed                                                                                                   |              3 | guarded             |
| Metal Cable       | Discipline: Metalbending                                       |   2 | 7     | unit (enemy)    | yes           | physical damage 6 + 0.6× power; pull 3 tiles                                                                                                                   |              2 | —                   |
| Metalbending      | Discipline: Metalbending                                       |   3 | 6     | unit (enemy)    | yes           | earth damage 11 + 1× power (ignores defense); rooted for 2 rounds (100%, to hit); stunned for 1 round (35%, to hit)                                            |              4 | rooted, stunned     |
| Mudslide          | Discipline: Earth Shaping                                      |   3 | 6     | blast, radius 2 | yes           | earth damage 4 + 0.4× power; mud surface (area, 4 rounds); rooted for 2 rounds (40%, to hit)                                                                   |              3 | mud, rooted         |
| Octopus Form      | Discipline: Ice Shaping                                        |   3 | 2     | blast, radius 2 | yes           | water damage 8 + 0.8× power; wet for 3 rounds (100%, to hit); guarded for 2 rounds (100%, to self); push 1 tile                                                |              4 | wet, guarded        |
| Oil Flask         | Enemy: Fire Nation Deserter                                    |   2 | 5     | blast, radius 1 | yes           | oil surface (area, permanent)                                                                                                                                  |              2 | oil                 |
| Oil Spray         | Enemy: The Driller                                             |   2 | 5     | line, length 4  | yes           | oil surface (area, permanent)                                                                                                                                  |              2 | oil                 |
| Pressure Points   | Discipline: Field Craft                                        |   3 | 1     | unit (enemy)    | yes           | physical damage 8 + 0.9× power (ignores defense); chiBlocked for 3 rounds (100%, to hit); slowed for 3 rounds (100%, to hit); grant 1 AP to self               |              4 | chiBlocked, slowed  |
| Purifying Mist    | Discipline: Healing                                            |   3 | 5     | blast, radius 1 | yes           | healing 8 + 0.6× focus; cleanse burning, blinded, shocked, chiBlocked; steam surface (area, 2 rounds)                                                          |              3 | steam               |
| Raise Rubble      | Character: Lin Mei, Enemy: Quarry Bender, Enemy: The Driller   |   2 | 5     | tile            | yes           | rubble surface (center, permanent)                                                                                                                             |              2 | rubble              |
| Rally             | Discipline: Field Craft, Enemy: Mercenary Sergeant             |   2 | 5     | unit (ally)     | yes           | inspired for 2 rounds (100%, to hit); grant 1 AP to hit                                                                                                        |              3 | inspired            |
| Rock Throw        | Character: Bo, Character: Lin Mei, Enemy: Quarry Bender        |   1 | 5     | unit (enemy)    | yes           | earth damage 5 + 0.6× power                                                                                                                                    | 0 (every turn) | —                   |
| Rush              | Enemy: Quarry Hauler, Enemy: Quarry Worker                     |   2 | 4     | tile            | yes           | dash                                                                                                                                                           |              2 | —                   |
| Seismic Sense     | Discipline: Earth Shaping                                      |   1 | 0     | self            | yes           | reveal surfaces; inspired for 2 rounds (100%, to self); cleanse blinded                                                                                        |              3 | inspired            |
| Shatterpoint      | Discipline: Sound Bending                                      |   3 | 7     | blast, radius 1 | yes           | air damage 13 + 1.1× power (ignores defense); stunned for 1 round (60%, to hit); push 2 tiles                                                                  |              4 | stunned             |
| Shield Bash       | Discipline: Field Craft                                        |   2 | 1     | unit (enemy)    | yes           | physical damage 6 + 0.6× power; push 1 tile; stunned for 1 round (35%, to hit); guarded for 1 round (100%, to self)                                            |              2 | stunned, guarded    |
| Shock Mine        | Discipline: Engineering                                        |   2 | 6     | blast, radius 1 | yes           | lightning damage 7 + 0.5× power; shocked for 2 rounds (80%, to hit); oil surface (center, 3 rounds)                                                            |              3 | shocked, oil        |
| Shockwave         | Character: Bo, Character: Lin Mei                              |   2 | 2     | blast, radius 2 | yes           | earth damage 5 + 0.5× power; push 1 tile; slowed for 2 rounds (50%, to hit)                                                                                    |              2 | slowed              |
| Shove             | Universal                                                      |   1 | 1     | unit (any)      | yes           | push 1 tile                                                                                                                                                    | 0 (every turn) | —                   |
| Sling Stone       | Enemy: Slinger                                                 |   2 | 6     | unit (enemy)    | yes           | physical damage 4 + 0.5× power                                                                                                                                 | 0 (every turn) | —                   |
| Smoke Bomb        | Discipline: Field Craft                                        |   2 | 5     | blast, radius 1 | yes           | blinded for 2 rounds (90%, to hit); steam surface (area, 2 rounds)                                                                                             |              3 | blinded, steam      |
| Sonic Boom        | Discipline: Sound Bending                                      |   2 | 7     | unit (enemy)    | yes           | air damage 7 + 0.7× power; stunned for 1 round (30%, to hit)                                                                                                   |              2 | stunned             |
| Stone Stance      | Character: Bo                                                  |   1 | 0     | self            | yes           | guarded for 2 rounds (100%, to self)                                                                                                                           |              2 | guarded             |
| Strike            | Character: Riko, Character: Wen                                |   1 | 1     | unit (enemy)    | yes           | physical damage 5 + 0.8× power                                                                                                                                 | 0 (every turn) | —                   |
| Take Cover        | Character: Riko, Character: Wen                                |   1 | 0     | self            | yes           | guarded for 2 rounds (100%, to self)                                                                                                                           |              2 | guarded             |
| Tidal Wave        | Discipline: Ice Shaping                                        |   3 | 5     | cone, length 4  | yes           | water damage 7 + 0.7× power; push 2 tiles; wet for 3 rounds (100%, to hit); water surface (area, 3 rounds)                                                     |              4 | wet, water          |
| Torch Toss        | Enemy: Fire Nation Deserter                                    |   1 | 5     | tile            | yes           | fire surface (center, 2 rounds)                                                                                                                                |              1 | fire                |
| Tornado           | Discipline: Air Shaping                                        |   3 | 7     | blast, radius 2 | yes           | air damage 7 + 0.8× power; push 3 tiles; blinded for 2 rounds (75%, to hit); slowed for 2 rounds (50%, to hit)                                                 |              4 | blinded, slowed     |
| Water Pull        | Character: Nilak, Character: Sura                              |   2 | 6     | unit (enemy)    | yes           | water damage 4 + 0.4× power; pull 3 tiles; wet for 2 rounds (100%, to hit)                                                                                     | 0 (every turn) | wet                 |
| Water Whip        | Character: Nilak, Character: Sura                              |   1 | 5     | unit (enemy)    | yes           | water damage 4 + 0.6× power; wet for 2 rounds (75%, to hit)                                                                                                    | 0 (every turn) | wet                 |

## Enemies

### Captain Ruon

- Stats: defense 3, focus 10, maxAp 4, maxHp 40, maxMove 4, power 7, speed 6
- Abilities: Captain’s Sabre, Bark an Order
- XP: 0

### Fire Nation Deserter

- Stats: defense 2, focus 10, maxAp 3, maxHp 34, maxMove 4, power 6, speed 6
- Abilities: Fire Blast, Oil Flask, Torch Toss
- XP: 200

### Mercenary

- Stats: defense 2, focus 10, maxAp 4, maxHp 32, maxMove 4, power 6, speed 6
- Abilities: Mercenary Blade
- XP: 150

### Mercenary Crossbow

- Stats: defense 1, focus 15, maxAp 4, maxHp 39, maxMove 4, power 5, speed 7
- Abilities: Crossbow
- XP: 150

### Mercenary Sergeant

- Stats: defense 3, focus 10, maxAp 5, maxHp 62, maxMove 4, power 6, speed 6
- Abilities: Mercenary Blade, Rally
- XP: 210

### Quarry Bender

- Stats: defense 3, focus 5, maxAp 2, maxHp 36, maxMove 3, power 6, speed 4
- Abilities: Rock Throw, Raise Rubble
- XP: 150

### Quarry Hauler

- Stats: defense 3, focus 5, maxAp 4, maxHp 42, maxMove 3, power 6, speed 4
- Abilities: Club Swing, Rush
- XP: 150

### Quarry Worker

- Stats: defense 1, focus 5, maxAp 4, maxHp 28, maxMove 4, power 5, speed 5
- Abilities: Club Swing, Rush
- XP: 100

### Slinger

- Stats: defense 0, focus 10, maxAp 4, maxHp 22, maxMove 4, power 4, speed 7
- Abilities: Sling Stone
- XP: 100

### The Driller

- Stats: defense 5, focus 5, maxAp 5, maxHp 80, maxMove 4, power 7, speed 4
- Abilities: Driller Slam, Debris Throw, Oil Spray, Churn the Ground, Raise Rubble
- XP: 360

## Encounters

### Ambush on the Forest Road

- Map: The Forest Road
- Expected level: 1
- Baseline party size: 3
- Authored roster: Quarry Worker; Quarry Worker; Slinger (300 XP)
- Conditional enemies: —
- Variants: thugs: Quarry Worker; Quarry Worker; Slinger (300 XP, 0.0% vs authored roster); slingers: Slinger; Slinger; Slinger (300 XP, 0.0% vs authored roster); bruisers: Quarry Hauler; Quarry Hauler (300 XP, 0.0% vs authored roster)
- Allies: —
- Reinforcements: Quarry Worker; Slinger

### The Cutting

- Map: The Cutting
- Expected level: 3
- Baseline party size: 3
- Authored roster: Mercenary; Mercenary; Mercenary Crossbow (450 XP)
- Conditional enemies: —
- Variants: —
- Allies: Captain Ruon
- Reinforcements: Mercenary; Mercenary Crossbow; Mercenary; Mercenary Sergeant

### The Driller

- Map: The Quarry Floor
- Expected level: 3
- Baseline party size: 3
- Authored roster: The Driller; Quarry Bender (510 XP)
- Conditional enemies: —
- Variants: jins_people: The Driller; Mercenary Crossbow (510 XP, 0.0% vs authored roster)
- Allies: —
- Reinforcements: Quarry Worker; Quarry Worker; Slinger; Quarry Bender

### The Quarry Gate

- Map: The Quarry Gate
- Expected level: 2
- Baseline party size: 3
- Authored roster: Fire Nation Deserter; Quarry Worker; Quarry Hauler (450 XP)
- Conditional enemies: —
- Variants: bluffed: Quarry Hauler; Quarry Bender; Quarry Hauler (450 XP, 0.0% vs authored roster)
- Allies: —
- Reinforcements: Quarry Worker; Slinger
