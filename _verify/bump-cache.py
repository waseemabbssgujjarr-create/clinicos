import pathlib
import re

root = pathlib.Path(r"C:\Users\DELL\Downloads\clinicosmg\clinicosmg")
pats = [
    (re.compile(r"dma-design-system\.css\?v=(52|53|54|55|56)"), "dma-design-system.css?v=57"),
    (re.compile(r"dashboard-doctor-shell\.css\?v=(19|20)"), "dashboard-doctor-shell.css?v=21"),
    (re.compile(r"superadmin-theme\.css\?v=(14|15)"), "superadmin-theme.css?v=16"),
]
skip_parts = {"node_modules", "_verify", "dma-ai-hostinger"}
changed = 0
for p in root.rglob("*"):
    if not p.is_file() or p.suffix not in {".html", ".js"}:
        continue
    if any(part in skip_parts for part in p.parts):
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    new = text
    for rx, repl in pats:
        new = rx.sub(repl, new)
    if new != text:
        p.write_text(new, encoding="utf-8")
        changed += 1
print("changed", changed)
