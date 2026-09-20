# 0031: Preserve off-turn support AP until activation

Status: accepted for the bounded support-AP correction.

## Problem

Air Cushion and Rally add AP to another unit while only the caster can act.
The recipient's `beginTurn` replaces current AP with its normal refill, so the
promised bonus disappears. A legal Nima-to-Jinu Air Cushion changed Jinu from
4 to 5 AP, then back to 4 when his turn began. Saving and loading between those
steps preserved 5 correctly; the loss came from turn preparation.

## Decision

Add `Unit.pendingAp`, distinct from the one-point unused-AP bank. A grant to
the currently active unit remains an immediate refund. A grant off-turn adds
to `pendingAp`; multiple grants accumulate, bounded by the existing total-AP
ceiling. The shared `startingAp` calculation combines effective maximum AP,
banked AP and pending AP under that same ceiling.

Beginning an activation clears both carry fields. Frozen/Stunned activations
consume the bonus while receiving zero AP, matching existing banking semantics.
Battle creation, result absorption and revival clear pending bonuses. No bonus
crosses into another encounter. Current-turn refunds also obey the shared cap;
Pressure Points still pays three AP and refunds one immediately.

The save schema adds a nonnegative bounded `pendingAp` with default zero.
This is an additive format-3 change: existing v3 saves, and older saves migrated
to v3, load without inventing a bonus. New saves preserve pending bonuses in
both party and battle unit records. An older executable cannot honor the new
behavior; compatibility means loading older saves in the updated game.

## Consequences and verification

No ability numbers, kits, roster, XP or new actions change. Support AI can now
deliver the AP its existing abilities promise; that intended effect can change
individual combat outcomes. Regression tests exercise legal Air Cushion before
and after the recipient's prior turn, save/reload, legacy v3 omission, stacking,
banking plus bonus, the global cap, skipped activations, Pressure Points and
battle transitions. Callers estimating next-turn AP must use `startingAp` rather
than copying its formula. The pending movement-warning adapter already does so.

Reusing `bankedAp` was rejected because it would conflate unused AP with support,
and a fixed status was rejected because the existing grant effect accepts amounts
and repeated applications. A separate field preserves both contracts directly.
