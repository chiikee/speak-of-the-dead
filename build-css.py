import re, sys
html = '\n'.join(open(f, encoding='utf-8').read() for f in sys.argv[1:])  # index.html plus the .js files

# ---- collect classes (static attributes, JS class strings, chart template) ----
classes = set()
for m in re.finditer(r'class(?:Name)?\s*=\s*["\']([^"\']+)["\']', html): classes.update(m.group(1).split())
for m in re.finditer(r"className\s*=\s*([^;]+);", html):
    for q in re.findall(r"'([^']*)'", m.group(1)): classes.update(q.split())
for m in re.finditer(r"classList\.(?:add|remove|toggle)\('([^']+)'", html): classes.add(m.group(1))
classes.update(['text-yellow-300', 'text-cyan-300'])
custom = {'crt','font-arcade','font-horror','font-jp','neon-text-red','neon-box-red','btn-mode-active',
          'btn-mode-inactive','btn-diff-active','btn-diff-inactive','input-miss'}
classes = {c for c in classes if c not in custom and '$' not in c}

C = {
 'black':'#000000','white':'#ffffff',
 'red-400':'#f87171','red-500':'#ef4444','red-600':'#dc2626','red-700':'#b91c1c','red-800':'#991b1b','red-900':'#7f1d1d','red-950':'#450a0a',
 'green-400':'#4ade80','green-500':'#22c55e','green-700':'#15803d','green-950':'#052e16',
 'purple-200':'#e9d5ff','purple-400':'#c084fc','purple-500':'#a855f7','purple-600':'#9333ea','purple-700':'#7e22ce','purple-800':'#6b21a8','purple-900':'#581c87','purple-950':'#3b0764',
 'yellow-100':'#fef9c3','yellow-300':'#fde047','yellow-400':'#facc15','yellow-500':'#eab308','yellow-700':'#a16207','yellow-950':'#422006',
 'zinc-600':'#52525b','zinc-700':'#3f3f46','zinc-800':'#27272a','zinc-900':'#18181b','zinc-950':'#09090b',
 'gray-200':'#e5e7eb','gray-300':'#d1d5db','gray-400':'#9ca3af','gray-500':'#6b7280',
 'blue-400':'#60a5fa','blue-500':'#3b82f6','cyan-300':'#67e8f9',
}
def color(spec):
    name, _, alpha = spec.partition('/')
    if name not in C: return None
    h = C[name].lstrip('#'); r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    a = int(alpha)/100 if alpha else 1
    return f'rgb({r} {g} {b} / {a:g})' if alpha else C[name], (r, g, b)

SP = {'0':'0px','0.5':'0.125rem','1':'0.25rem','1.5':'0.375rem','2':'0.5rem','2.5':'0.625rem','3':'0.75rem','3.5':'0.875rem',
      '4':'1rem','5':'1.25rem','6':'1.5rem','7':'1.75rem','8':'2rem','16':'4rem','24':'6rem','32':'8rem','44':'11rem','48':'12rem'}
TEXT = {'xs':('0.75rem','1rem'),'sm':('0.875rem','1.25rem'),'base':('1rem','1.5rem'),'lg':('1.125rem','1.75rem'),
        'xl':('1.25rem','1.75rem'),'2xl':('1.5rem','2rem'),'3xl':('1.875rem','2.25rem'),'4xl':('2.25rem','2.5rem'),
        '5xl':('3rem','1'),'6xl':('3.75rem','1')}
TRANS = 'transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:150ms'
STATIC = {
 'absolute':'position:absolute','relative':'position:relative','inset-0':'inset:0px',
 'block':'display:block','inline':'display:inline','inline-block':'display:inline-block','flex':'display:flex','grid':'display:grid',
 'flex-1':'flex:1 1 0%','flex-col':'flex-direction:column','flex-row':'flex-direction:row','flex-wrap':'flex-wrap:wrap','shrink-0':'flex-shrink:0',
 'items-center':'align-items:center','items-end':'align-items:flex-end','items-start':'align-items:flex-start','items-stretch':'align-items:stretch',
 'justify-between':'justify-content:space-between','justify-center':'justify-content:center','justify-end':'justify-content:flex-end',
 'col-span-5':'grid-column:span 5 / span 5','my-auto':'margin-top:auto;margin-bottom:auto',
 'w-full':'width:100%','w-auto':'width:auto','h-full':'height:100%','min-h-0':'min-height:0px','min-w-0':'min-width:0px','max-h-full':'max-height:100%',
 'max-w-xs':'max-width:20rem','max-w-lg':'max-width:32rem','max-w-xl':'max-width:36rem','max-w-3xl':'max-width:48rem',
 'overflow-hidden':'overflow:hidden','overflow-y-auto':'overflow-y:auto',
 'truncate':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap','whitespace-nowrap':'white-space:nowrap',
 'pointer-events-none':'pointer-events:none','cursor-pointer':'cursor:pointer',
 'border':'border-width:1px','border-2':'border-width:2px','border-b':'border-bottom-width:1px','border-t':'border-top-width:1px',
 'rounded':'border-radius:0.25rem','rounded-sm':'border-radius:0.125rem','rounded-lg':'border-radius:0.5rem','rounded-xl':'border-radius:0.75rem','rounded-full':'border-radius:9999px',
 'text-left':'text-align:left','text-center':'text-align:center','italic':'font-style:italic',
 'font-sans':'font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
 'font-mono':'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
 'font-semibold':'font-weight:600','font-bold':'font-weight:700',
 'tracking-wide':'letter-spacing:0.025em','tracking-wider':'letter-spacing:0.05em','tracking-widest':'letter-spacing:0.1em',
 'leading-relaxed':'line-height:1.625','leading-snug':'line-height:1.375',
 'opacity-0':'opacity:0','opacity-60':'opacity:0.6','opacity-70':'opacity:0.7','opacity-80':'opacity:0.8',
 'fill-current':'fill:currentColor',
 'z-10':'z-index:10','z-20':'z-index:20','z-30':'z-index:30','z-40':'z-index:40','z-50':'z-index:50',
 'order-2':'order:2','order-3':'order:3',
 'grid-cols-1':'grid-template-columns:repeat(1,minmax(0,1fr))','grid-cols-2':'grid-template-columns:repeat(2,minmax(0,1fr))',
 'grid-cols-3':'grid-template-columns:repeat(3,minmax(0,1fr))','grid-cols-5':'grid-template-columns:repeat(5,minmax(0,1fr))',
 'backdrop-blur-sm':'-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)','backdrop-blur-md':'-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)',
 'bg-gradient-to-r':'background-image:linear-gradient(to right,var(--tw-gradient-stops))',
 'shadow-lg':'--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,rgb(0 0 0 / .1)),0 4px 6px -4px var(--tw-shadow-color,rgb(0 0 0 / .1));box-shadow:var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)',
 'shadow-2xl':'--tw-shadow:0 25px 50px -12px var(--tw-shadow-color,rgb(0 0 0 / .25));box-shadow:var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)',
 'transition-all':'transition-property:all;'+TRANS,
 'transition-colors':'transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;'+TRANS,
 'transition-opacity':'transition-property:opacity;'+TRANS,
 'duration-75':'transition-duration:75ms','duration-150':'transition-duration:150ms','duration-300':'transition-duration:300ms',
 'animate-pulse':'animation:tw-pulse 2s cubic-bezier(.4,0,.6,1) infinite','animate-ping':'animation:tw-ping 1s cubic-bezier(0,0,.2,1) infinite',
 'outline-none':'outline:2px solid transparent;outline-offset:2px',
 'ring-2':'--tw-ring-shadow:0 0 0 2px var(--tw-ring-color,rgb(59 130 246 / .5));box-shadow:var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000)',
 'hidden':'display:none',
}
def decl(base):
    if base in STATIC: return STATIC[base]
    m = re.fullmatch(r'(p|px|py|pt|pb|mb|mt|gap|gap-x|gap-y|w|h|space-y)-([\d.]+)', base)
    if m and m.group(2) in SP:
        k, v = m.group(1), SP[m.group(2)]
        return {'p':f'padding:{v}','px':f'padding-left:{v};padding-right:{v}','py':f'padding-top:{v};padding-bottom:{v}',
                'pt':f'padding-top:{v}','pb':f'padding-bottom:{v}','mb':f'margin-bottom:{v}','mt':f'margin-top:{v}',
                'gap':f'gap:{v}','gap-x':f'column-gap:{v}','gap-y':f'row-gap:{v}','w':f'width:{v}','h':f'height:{v}',
                'space-y':f'margin-top:{v}'}[k]
    m = re.fullmatch(r'text-\[(\d+px)\]', base)
    if m: return f'font-size:{m.group(1)}'
    m = re.fullmatch(r'text-(xs|sm|base|lg|xl|[2-6]xl)', base)
    if m: fs, lh = TEXT[m.group(1)]; return f'font-size:{fs};line-height:{lh}'
    m = re.fullmatch(r'(bg|text|border|from|via|to|accent|shadow|ring)-(.+)', base)
    if m:
        c = color(m.group(2))
        if c:
            val, (r, g, b) = c
            k = m.group(1)
            if k == 'bg': return f'background-color:{val}'
            if k == 'text': return f'color:{val}'
            if k == 'border': return f'border-color:{val}'
            if k == 'accent': return f'accent-color:{val}'
            if k == 'shadow': return f'--tw-shadow-color:{val}'
            if k == 'ring': return f'--tw-ring-color:{val}'
            if k == 'from': return f'--tw-gradient-from:{val};--tw-gradient-to:rgb({r} {g} {b} / 0);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)'
            if k == 'via': return f'--tw-gradient-to:rgb({r} {g} {b} / 0);--tw-gradient-stops:var(--tw-gradient-from),{val},var(--tw-gradient-to)'
            if k == 'to': return f'--tw-gradient-to:{val}'
    return None

def esc(c): return re.sub(r'([^a-zA-Z0-9_-])', r'\\\1', c)

# order so later groups override earlier ones, like Tailwind
def rank(base):
    if base == 'hidden': return 3            # must beat flex/grid/block
    if base.startswith('duration-'): return 2 # must beat transition-* defaults
    if base.startswith(('from-',)): return 4
    if base.startswith(('via-',)): return 5
    if base.startswith(('to-',)): return 6
    return 1
groups = {'': [], 'hover': [], 'focus': [], 'active': [], 'sm': [], 'md': []}
missing = []
for c in sorted(classes):
    parts = c.split(':'); base = parts[-1]; variant = parts[0] if len(parts) > 1 else ''
    d = decl(base)
    if d is None: missing.append(c); continue
    sel = '.' + esc(c)
    if variant in ('hover', 'focus', 'active'): sel += ':' + variant
    if base.startswith('space-y-'): sel += ' > :not([hidden]) ~ :not([hidden])'
    groups[variant].append((rank(base), sel, d))
if missing: print('UNMAPPED:', missing, file=sys.stderr); sys.exit(1)

out = ['/* Tailwind-compatible utilities, precompiled for the classes this page uses (no CDN needed). */',
'*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}',
'html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4}',
'body{line-height:inherit}',
'h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit;margin:0}',
'p,dl,dd,figure,pre{margin:0}',
'strong{font-weight:bolder}',
'button,input,select,textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}',
'button{background-color:transparent;background-image:none;cursor:pointer;text-transform:none;-webkit-appearance:button}',
'button:disabled{cursor:default}',
'input::placeholder{opacity:1;color:#9ca3af}',
'svg,canvas{display:block;vertical-align:middle}',
'@keyframes tw-pulse{50%{opacity:.5}}',
'@keyframes tw-ping{75%,100%{transform:scale(2);opacity:0}}']
for v in ['', 'hover', 'focus', 'active']:
    for _, sel, d in sorted(groups[v], key=lambda x: x[0]): out.append(f'{sel}{{{d}}}')
for v, w in [('sm', '640px'), ('md', '768px')]:
    if groups[v]:
        out.append(f'@media (min-width:{w}){{')
        for _, sel, d in sorted(groups[v], key=lambda x: x[0]): out.append(f'  {sel}{{{d}}}')
        out.append('}')
print('\n'.join(out))
