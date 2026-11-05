"""tutorial-demo.html: the shell (src/tut/) with Ba Dan v13 (badan-topdown.html) and the board engine (t13/board.html) inlined as
documents. Build those two first (sh tools/v13build.sh; python3 tools/build_b3.py tutorial)."""
import json
from pathlib import Path
H = Path(__file__).resolve().parent.parent
docs = {'badan': (H / 'badan-topdown.html').read_text(), 'board': (H / 't13' / 'board.html').read_text()}
js = 'const DOCS = ' + json.dumps(docs).replace('</', '<\\/') + ';'
html = (H / 'src' / 'tut' / 'shell.html').read_text().replace('/*DOCS*/', js).replace('/*SHELL*/', (H / 'src' / 'tut' / 'shell.js').read_text())
(H / 'tutorial-demo.html').write_text(html); print('wrote tutorial-demo.html', len(html) // 1024, 'KiB')
