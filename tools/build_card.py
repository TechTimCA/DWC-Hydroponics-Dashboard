"""Build the Home Assistant card.

    python3 tools/build_card.py [version]

Reads  src/dashboard-source.html (layout, styles, live-value logic) + src/ha-card/card.template.js
Writes dwc-control-center-card.js and bg.webp in the repo root — the two files you copy to
       Home Assistant's www/dwc/ folder.
"""
import pathlib, re, sys, shutil

root = pathlib.Path(__file__).resolve().parent.parent
version = sys.argv[1] if len(sys.argv) > 1 else "0.1.0"
tpl = (root / "src/dashboard-source.html").read_text()
card_tpl = (root / "src/ha-card/card.template.js").read_text()

def between(s, a, b, inclusive_a=False):
    i = s.index(a); j = s.index(b, i + len(a))
    return s[i if inclusive_a else i + len(a):j]

def lit(s):  # safe inside a JS template literal
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

# ---- CSS ----
css = between(tpl, "<style>", "</style>")
css = css.replace(":root{", ":host{", 1)
css = re.sub(r"\n\s*html,body\{[^}]*\}", "", css)
css = re.sub(r"\n\s*body\{[^}]*\}", "", css)
css = re.sub(r"\n\s*#viewport\{[^}]*\}", "", css)
css = re.sub(r"\n\s*#stage\{[^}]*\}", "\n  #stage{position:absolute;width:1536px;height:1024px;background:0 0/1536px 1024px no-repeat;}", css)
css = re.sub(r"\n\s*#modal[^{]*\{[^}]*\}", "", css)
assert "__BG__" not in css

# ---- stage markup (no settings button / modal: HA handles the connection) ----
stage = between(tpl, '<div id="viewport">', '<div id="modal"')
stage = stage[stage.index('<div id="stage"'):]
stage = re.sub(r'\s*<button class="hit" id="btnSettings"[^>]*></button>', "", stage)
stage = stage.rstrip() + "\n  </div>"

# ---- default config ----
cfg = between(tpl, "const CONFIG = ", "\n};", inclusive_a=False) + "\n}"
cfg = re.sub(r"\n\s*haUrl:[^\n]*", "", cfg)
cfg = re.sub(r"\n\s*token:[^\n]*", "", cfg)

# ---- shared dashboard code ----
js = tpl[tpl.index("/* ================= LAYOUT"):tpl.index("/* ================= demo simulation")]
fit = js[js.index("/* ================= fit to screen"):js.index("/* ================= build overlay")]
js = js.replace(fit, "")
js = js.replace('const $ = (s,r=document)=>r.querySelector(s);', 'const $ = (s,r=root)=>r.querySelector(s);')
js = js.replace('b.addEventListener("click",()=>runAction(k,label));', 'b.addEventListener("click",()=>host._runAction(k,label));')
ha = tpl[tpl.index("const entityIndex = {};"):tpl.index("function send(")]
mount = "\n".join("  " + l for l in (js + "\n" + ha).splitlines())
for needle in ['host._runAction', 'r=root', 'function applyState']:
    assert needle in mount, needle

out = (card_tpl.replace("__VERSION__", version).replace("__CSS__", lit(css)).replace("__STAGE__", lit(stage))
       .replace("__DEFAULTS__", cfg).replace("__MOUNT__", mount))
(root / "dwc-control-center-card.js").write_text(out)

shutil.copy(root / "src/bg.webp", root / "bg.webp")
print(f"card {len(out)//1024} KB, version {version} — copy dwc-control-center-card.js and bg.webp to HA's www/dwc/")
