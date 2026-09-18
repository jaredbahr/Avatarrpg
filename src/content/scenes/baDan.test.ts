import { expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../maps/village';
import { BA_DAN_POND } from './baDan';

it('registers the painted pond to every actual permanent-water cell', () => {
  const painted: string[] = [];
  for (let y = BA_DAN_POND.y; y < BA_DAN_POND.y + BA_DAN_POND.height; y++) {
    for (let x = BA_DAN_POND.x; x < BA_DAN_POND.x + BA_DAN_POND.width; x++) {
      painted.push(`${x},${y}`);
    }
  }
  const actual = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) =>
      BA_DAN_VILLAGE.legend[key]?.surface === 'water' ? [`${x},${y}`] : [],
    ),
  );
  expect(painted).toEqual(actual);
});
