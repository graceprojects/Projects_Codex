from pathlib import Path
import re
root=Path(__file__).resolve().parent/'site'
for f in root.rglob('*'):
    if f.suffix not in ['.html','.js','.json']: continue
    s=f.read_text()
    s=s.replace('BASHKENT HEAVEN','HAVEN').replace('Bashkent Heaven','HAVEN').replace('Bashkent-Heaven','HAVEN')
    f.write_text(s)
logo='<img class="haven-logo" src="assets/brand/haven-logo.svg" alt="HAVEN — Halovat makoni" width="150" height="100">'
for name in ['index.html','map3d.html']:
    f=root/name; s=f.read_text()
    s=re.sub(r'<link[^>]+(?:fonts.googleapis.com|fonts.gstatic.com)[^>]*>','',s)
    s=s.replace('<link rel="stylesheet" href="styles.css?v=63">','<link rel="stylesheet" href="fonts.css?v=haven-1">\n  <link rel="stylesheet" href="styles.css?v=haven-1">\n  <link rel="stylesheet" href="haven.css?v=1">\n  <link rel="icon" type="image/svg+xml" href="assets/brand/haven-symbol.svg">')
    s=s.replace('<meta name="theme-color" content="#10191c">','<meta name="theme-color" content="#F4EFE8">')
    s=re.sub(r'<span class="brand-mark">B<span>H</span></span><span class="brand-name">BASHKENT<br>HEAVEN</span>',logo,s)
    s=s.replace('script.js?v=53','script.js?v=haven-1').replace('map2d.js?v=8','map2d.js?v=haven-1').replace('map3d.js?v=56','map3d.js?v=haven-1')
    if name=='index.html':
        s=s.replace('HAVEN — новый взгляд на город','HAVEN — дом, где начинается тишина')
        s=s.replace('<div class="loader-mark">B<span>H</span></div>','<img class="loader-logo" src="assets/brand/haven-logo-light.svg" alt="HAVEN — Halovat makoni" width="270" height="180">')
        s=s.replace('<div class="loader-word"><span>BASHKENT</span><span>HEAVEN</span></div>','<div class="loader-word">ИСКУССТВО БЫТЬ ДОМА</div>')
        s=re.sub(r'<span class="header-line"></span>.*?</header>', '<nav class="haven-nav" aria-label="Основная навигация"><a href="#about">О проекте</a><a href="#hscroll">Галерея</a><a href="#location">Расположение</a></nav><a class="haven-header-cta" href="#explore">Выбрать квартиру <span aria-hidden="true">↗</span></a></header>',s,flags=re.S)
        s=s.replace('<div class="intro-image"></div>','<div class="intro-image" role="img" aria-label="Архитектура резиденций HAVEN"><span class="haven-image-caption">HAVEN / ТАШКЕНТ</span></div><div class="haven-hero-lines" aria-hidden="true"></div>')
        s=s.replace('ТАШКЕНТ / НОВАЯ ВЫСОТА ЖИЗНИ','РЕЗИДЕНЦИИ В ТАШКЕНТЕ')
        s=re.sub(r'<h1 id="hero-title">.*?</h1>','<h1 id="hero-title"><span class="ln"><span>Дом, где</span></span><span class="ln"><span>начинается</span></span><span class="ln"><span><em>тишина.</em></span></span></h1>',s)
        s=s.replace('Архитектура, которая открывает больше. Выберите свой корпус и найдите пространство, созданное для вас.','Город остаётся за порогом. Внутри — свет, пространство и время для самого важного.')
        s=s.replace('<span>Начать путешествие</span>','<span>Найти свой дом</span>')
        s=s.replace('<span>01 / 03</span><span>ПРОКРУТИТЕ ВНИЗ, ЧТОБЫ ИССЛЕДОВАТЬ</span><span>↓</span>','<span>HALOVAT MAKONI</span><span>МЕСТО ВАШЕГО СПОКОЙСТВИЯ</span><a href="#about" aria-label="Узнать о проекте">↓</a>')
        s=s.replace('<section class="manifesto" aria-label="О проекте">','<section id="about" class="manifesto" aria-label="О проекте">')
        s=s.replace('МАНИФЕСТ','01 / ФИЛОСОФИЯ HAVEN')
        s=s.replace('HAVEN — это город над городом. Сады на крышах, ресторан в сфере, панорамные резиденции и тишина, которую слышно даже в самом центре Ташкента.','Дом — это больше, чем пространство. Это тишина за порогом, мягкий утренний свет и ощущение, что вы на своём месте.')
        s=s.replace('</section>\n\n      <section class="stats"','<div class="haven-about-bottom"><span>HALOVAT MAKONI</span><p>HAVEN объединяет архитектуру, городские виды и пространства для повседневной жизни. Изучите проект и выберите свой ритм.</p></div></section>\n\n      <section class="stats"',1)
        s=s.replace('НОВАЯ ВЫСОТА ЖИЗНИ ✦ HAVEN ✦ ГОРОД НАД ГОРОДОМ ✦','HAVEN · HALOVAT MAKONI · ИСКУССТВО БЫТЬ ДОМА ·')
        s=s.replace('ГАЛЕРЕЯ / ЖИЗНЬ В ПРОЕКТЕ','02 / ЖИЗНЬ В HAVEN').replace('Моменты,<br><em>ради которых.</em>','Красота<br><em>каждого дня.</em>')
        s=s.replace('ЛОКАЦИЯ / ЧТО РЯДОМ','03 / ГОРОД РЯДОМ').replace('Весь Ташкент —<br><em>в нескольких минутах.</em>','Ваш город.<br><em>Вокруг вашего дома.</em>')
        s=s.replace('ПРОСТРАНСТВО ДЛЯ ВАШЕЙ ИСТОРИИ','ВАШЕ ПРОСТРАНСТВО В HAVEN').replace('Ваш следующий<br><em>горизонт начинается здесь.</em>','Найдите дом,<br><em>близкий вам.</em>').replace('Вернуться к выбору <span>↑</span>','Выбрать квартиру <span>↗</span>')
        s=s.replace('    </main>','    </main>\n    <footer class="haven-footer"><a href="#top" class="haven-footer-brand" aria-label="HAVEN — наверх"><img src="assets/brand/haven-logo-light.svg" alt="HAVEN — Halovat makoni" width="210" height="140"></a><div class="haven-footer-copy"><p>Место вашего спокойствия.</p><span>Ташкент, Узбекистан</span></div><nav aria-label="Навигация в подвале"><a href="#about">О проекте</a><a href="#explore">Выбор квартиры</a><a href="#hscroll">Галерея</a><a href="#location">Расположение</a></nav><div class="haven-footer-bottom"><span>© 2026 HAVEN</span><span>HALOVAT MAKONI</span><a href="#top">Наверх ↑</a></div></footer>',1)
    f.write_text(s)
# Translate the existing interface palette, without recolouring architectural models.
f=root/'styles.css'; s=f.read_text()
colors={'#18262a':'#4a3226','#f4f1e9':'#f4efe8','#e8c894':'#cba087','#10191c':'#4a3226','#0c1619':'#4a3226','#0f1c1f':'#4a3226','#132228':'#4a3226','#e8ce9c':'#cba087','#e7c99b':'#d7c3b7','#e9cc99':'#d7c3b7','#efd1a2':'#cba087','#e7d9ae':'#d7c3b7','#fff4cd':'#f4efe8','#eccf91':'#cba087','#92764d':'#84482e','#8a6a36':'#84482e','#243b3c':'#4a3226','#46605c':'#84482e','#f4f0e6':'#f4efe8','#14120f':'#4a3226','#172b2d':'#4a3226','#152428':'#4a3226','#122026':'#4a3226','#f6e8c9':'#d7c3b7','#d7d6cc':'#d7c3b7'}
for old,new in colors.items(): s=re.sub(re.escape(old)+r'(?![0-9a-f])',new,s,flags=re.I)
s=s.replace('24,38,42','74,50,38').replace('232,200,148','203,160,135').replace('231,205,154','203,160,135').replace('237,211,159','203,160,135')
f.write_text(s)
f=root/'script.js'; s=f.read_text().replace('Жизнь в центре<br><em>внимания.</em>','Ближе<br><em>к спокойствию.</em>').replace('Больше пространства<br><em>для вашего.</em>','Пространство<br><em>для своего ритма.</em>').replace('На высоте<br><em>новых идей.</em>','Горизонты<br><em>вашего дома.</em>')
s=s.replace('<div class="ps-brand"><b>HAVEN</b>','<div class="ps-brand"><img src="assets/brand/haven-logo.svg" alt="HAVEN — Halovat makoni" style="width:150px;height:100px">')
f.write_text(s)
# Restrained signature line motif, separate from the untouched original logo.
lines=[]
for i in range(61):
    x=10+i*10; h=30+220*(abs(i-30)/30)**1.6
    lines.append(f'<path d="M{x} {280-h:.2f}V280"/>')
(root/'assets/brand/haven-lines.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 300" fill="none" stroke="#CBA087" stroke-width="1">'+''.join(lines)+'</svg>')
logo=(root/'assets/brand/haven-logo.svg').read_text()
(root/'assets/brand/haven-symbol.svg').write_text(logo.replace('viewBox="165 182.5 550 367.5"','viewBox="350 207 157 155"'))
print('HAVEN identity applied')
