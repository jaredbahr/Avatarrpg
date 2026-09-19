import type { ContentIndex, Grid, MapDef, Vec2, GameState } from '../../core/types';
import { evaluate } from '../../core/story/conditions';
import { visibleNpcs } from '../../core/story/world';
import { previewWalk } from '../world/walking';
import { Dialog } from './Dialog';
import { button, el } from './dom';

const NS = 'http://www.w3.org/2000/svg';
function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

/** North-up topology from the same walkable grid as the world; never a painted map. */
export class LocalMap {
  readonly element: SVGSVGElement;
  private party: SVGCircleElement[] = [];

  constructor(map: MapDef, grid: Grid, state: GameState, showLabels = false) {
    this.element = svgNode('svg', {
      viewBox: `-1 -1 ${grid.width + 2} ${grid.height + 2}`,
      class: 'local-map',
      role: 'img',
      'aria-label': `${map.name}: north-up local map`,
    });
    const title = svgNode('title', {});
    title.textContent = `${map.name}. Green circles: party. Gold: people. Diamonds: exits. Dark ground is blocked.`;
    this.element.append(title);
    grid.tiles.forEach((tile, index) => {
      this.element.append(
        svgNode('rect', {
          x: String(index % grid.width),
          y: String(Math.floor(index / grid.width)),
          width: '1.02',
          height: '1.02',
          class: `local-ground terrain-${tile.terrain}${tile.surface ? ` surface-${tile.surface.id}` : ''}${tile.blocked ? ' blocked' : ''}`,
        }),
      );
    });
    for (const npc of visibleNpcs(map, state)) {
      const dot = svgNode('circle', {
        cx: String(npc.pos.x + 0.5),
        cy: String(npc.pos.y + 0.5),
        r: '.38',
        class: 'local-npc',
      });
      const label = svgNode('title', {});
      label.textContent = npc.name;
      dot.append(label);
      this.element.append(dot);
      if (showLabels) {
        const visibleLabel = svgNode('text', {
          x: String(npc.pos.x + 0.9),
          y: String(npc.pos.y + 0.35),
          class: 'local-npc-label',
        });
        visibleLabel.textContent = npc.name;
        this.element.append(visibleLabel);
      }
    }
    for (const exit of map.exits ?? []) {
      const x = exit.pos.x + 0.5;
      const y = exit.pos.y + 0.5;
      this.element.append(
        svgNode('path', {
          d: `M${x} ${y - 0.6}l.6 .6-.6 .6-.6-.6Z`,
          class: `local-exit${evaluate(state, exit.requires) ? '' : ' locked'}`,
        }),
      );
    }
    this.party = state.party.map(() => {
      const dot = svgNode('circle', { cx: '0', cy: '0', r: '.38', class: 'local-party' });
      this.element.append(dot);
      return dot;
    });
    this.update(state.party.map(() => state.location.pos));
  }

  update(positions: readonly Vec2[]): void {
    this.party.forEach((dot, index) => {
      const pos = positions[index];
      if (!pos) return;
      dot.setAttribute('cx', String(pos.x + 0.5));
      dot.setAttribute('cy', String(pos.y + 0.5));
    });
  }
}

export class LocalMapDialog extends Dialog {
  protected options = { title: 'Local map' };
  constructor(
    private map: MapDef,
    private grid: Grid,
    private state: GameState,
    private content: ContentIndex,
    private positions: readonly Vec2[],
    private walk: (pos: Vec2) => void,
    private recenter: () => void,
    private objectiveNpcId: string | null = null,
  ) {
    super();
  }

  protected build(body: HTMLElement): void {
    const map = new LocalMap(this.map, this.grid, this.state, true);
    map.update(this.positions);
    body.append(
      map.element,
      el('p', {
        class: 'tiny muted',
        text: 'North ↑ · Green: party · Gold: people · Diamonds: exits · Dark: blocked',
      }),
    );
    const routes = el('div', {
      class: 'stack',
      attrs: { role: 'navigation', 'aria-label': 'Routes from this area' },
    });
    const target = this.objectiveNpcId
      ? visibleNpcs(this.map, this.state).find((npc) => npc.id === this.objectiveNpcId)
      : undefined;
    if (target) {
      const preview = previewWalk(this.content, this.state, target.pos);
      if (!preview.refusal) {
        routes.append(
          button(`Walk to ${target.name}`, () => {
            this.close();
            this.walk(target.pos);
          }),
        );
      }
    }
    for (const exit of this.map.exits ?? []) {
      const open = evaluate(this.state, exit.requires);
      routes.append(
        button(
          exit.label,
          () => {
            this.close();
            this.walk(exit.pos);
          },
          {
            disabled: !open,
            title: open ? `Walk to ${exit.label}` : exit.lockedHint,
          },
        ),
      );
      if (!open && exit.lockedHint)
        routes.append(el('span', { class: 'tiny muted', text: exit.lockedHint }));
    }
    body.append(
      routes,
      button('Follow party', () => {
        this.close();
        this.recenter();
      }),
      button('Close map', () => this.close()),
    );
  }
}
