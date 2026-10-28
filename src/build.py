import base64,sys
M='/tmp/claude-0/-home-claude/0c9b59e7-e0d8-5296-9ac2-1608fb78dd0c/scratchpad/media/'
def u(f,t): return 'data:%s;base64,'%t+base64.b64encode(open(M+f,'rb').read()).decode()
local='local' in sys.argv
s=open('template.html').read()
s=s.replace('{{HALL}}',u('hall.webp','image/webp'))
s=s.replace('{{THREE}}','<script src="%s"></script>'%('../vendor/package/build/three.min.js' if local else 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'))
s=s.replace('{{LINEJS}}',open('line.js').read()).replace('{{A3D}}',open('ablauf3d.js').read()).replace('{{FILM}}',open('anlage3d.js').read())
if local:
    F='../vendor/fonts/'
    ff=''
    for fam,dirn,ws in [('Barlow','fontsource-barlow-5.3.0/package/files/barlow-latin-%s-normal.woff2',[400,500,600,700]),('Barlow Condensed','fontsource-barlow-condensed-5.3.0/package/files/barlow-condensed-latin-%s-normal.woff2',[500,600,700]),('Bebas Neue','fontsource-bebas-neue-5.3.0/package/files/bebas-neue-latin-%s-normal.woff2',[400])]:
        for w in ws: ff+="@font-face{font-family:'%s';font-weight:%d;src:url(%s%s) format('woff2')}"%(fam,w,F,dirn%w)
    s=s.replace('<style>','<style>'+ff,1)
open('local.html' if local else 'index.html','w').write(s); print(len(s))
