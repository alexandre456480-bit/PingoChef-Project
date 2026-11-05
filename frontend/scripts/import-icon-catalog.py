"""Import curated, licensed upstream assets; regenerate with Python 3 (network required).
No upstream code is executed. SVG imports accept drawing primitives only.
"""
import concurrent.futures as futures
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend/public/assets/catalog'
CONSTANTS = ROOT / 'frontend/src/app/constants'
ASSETS.mkdir(parents=True, exist_ok=True)
(ASSETS / 'licenses').mkdir(exist_ok=True)

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'PingoChef-icon-import'}), timeout=60).read()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# The manifest pins each library commit after the initial import.
manifest_path = ASSETS / 'sources.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
repos = {'Lucide': 'lucide-icons/lucide', 'Tabler': 'tabler/tabler-icons',
         'Phosphor': 'phosphor-icons/core', 'Fluent Emoji': 'microsoft/fluentui-emoji'}
for source, repo in repos.items():
    if source not in manifest:
        head = json.loads(fetch(f'https://api.github.com/repos/{repo}/commits?per_page=1'))[0]['sha']
        manifest[source] = {'repository': f'https://github.com/{repo}', 'commit': head}
    license_data = fetch(f'https://raw.githubusercontent.com/{repo}/{manifest[source]["commit"]}/LICENSE')
    (ASSETS / 'licenses' / f'{source.lower().replace(" ", "-")}.txt').write_bytes(license_data)
write_json(manifest_path, manifest)

# Group | library | icon:Portuguese label (also searchable by original name/library).
CURATED = '''
Corações & Afeto|Lucide|heart:Coração,heart-pulse:Coração pulsando,heart-off:Coração riscado,hand-heart:Carinho
Estrelas & Destaques|Lucide|star:Estrela,sparkles:Brilhos,flame:Em alta,zap:Energia,crown:Coroa,gem:Diamante,badge-check:Selo de aprovação
Prêmios & Conquistas|Lucide|trophy:Troféu,medal:Medalha,award:Prêmio,badge:Selo clássico,target:Meta,thumbs-up:Aprovado
Utensílios & Cozinha|Lucide|chef-hat:Chapéu do chef,cooking-pot:Panela,utensils:Talheres,utensils-crossed:Talheres cruzados,hand-platter:Prato servido,soup:Sopa,microwave:Micro-ondas,refrigerator:Geladeira
Serviço & Entrega|Lucide|bike:Entrega de bicicleta,truck:Entrega,shopping-bag:Sacola,shopping-basket:Cesta,store:Loja,concierge-bell:Atendimento,clock:Horário,map-pin:Localização,ticket-percent:Cupom,percent:Desconto
Natureza & Ingredientes|Lucide|leaf:Folha,sprout:Broto,flower-2:Flor,trees:Árvores,sun:Sol,moon:Lua,droplets:Gotas,wheat:Trigo
Frutas & Legumes|Lucide|apple:Maçã,banana:Banana,cherry:Cereja,citrus:Cítrico,grape:Uva,carrot:Cenoura
Festas & Celebrações|Lucide|party-popper:Festa,gift:Presente,balloon:Balão,cake-slice:Fatia de bolo,audio-lines:Som ambiente
Animais|Lucide|fish:Peixe,shrimp:Camarão,bird:Pássaro,rabbit:Coelho,beef:Carne bovina
Corações & Afeto|Tabler|heart-filled:Coração preenchido,hearts:Dois corações,heart-handshake:Parceria,heart-bolt:Coração elétrico,heart-star:Coração com estrela
Estrelas & Destaques|Tabler|star-filled:Estrela preenchida,stars:Constelação,sparkles:Centelhas,diamond-filled:Diamante sólido,flame-filled:Chama preenchida
Prêmios & Conquistas|Tabler|trophy-filled:Troféu preenchido,award-filled:Selo premiado,medal-2:Medalha de campeão,laurel-wreath:Coroa de louros,rosette-discount-check:Selo verificado
Pratos & Carnes|Tabler|grill:Churrasqueira,meat:Corte de carne,fish:Peixe grelhado,egg-fried:Ovo frito,bowl-spoon:Tigela com colher
Pizzas & Massas|Tabler|pizza:Pizza,tools-kitchen-2:Garfo e faca
Japonês & Oriental|Tabler|bowl-chopsticks:Tigela com hashis,soup:Sopa oriental
Padaria & Café|Tabler|bread:Pão,coffee:Café,teapot:Bule,mug:Caneca
Sobremesas|Tabler|ice-cream:Sorvete,cookie:Cookie,candy:Bala,lollipop:Pirulito
Bebidas|Tabler|glass-cocktail:Coquetel,beer:Cerveja,bottle:Garrafa,bubble-tea:Bubble tea
Corações & Afeto|Phosphor|heart-straight:Coração reto,heart-half:Meio coração,hand-heart:Gesto de carinho
Estrelas & Destaques|Phosphor|shooting-star:Estrela cadente,star-four:Estrela de quatro pontas,seal-check:Selo de qualidade,fire:Chama
Prêmios & Conquistas|Phosphor|trophy:Troféu clássico,medal-military:Medalha de honra,ranking:Ranking,crown-simple:Coroa simples
Serviço & Entrega|Phosphor|motorcycle:Motoboy,package:Embalagem,receipt:Comanda,contactless-payment:Pagamento por aproximação,qr-code:QR Code
Utensílios & Cozinha|Phosphor|oven:Forno,knife:Faca,cooking-pot:Panela do chef,fork-knife:Talheres de mesa
Mundo & Viagens|Phosphor|globe-hemisphere-west:Sabores do mundo,airplane:Avião,compass:Rosa dos ventos
Saudável & Veg|Phosphor|plant:Planta,leaf:Folha orgânica,orange-slice:Fatia de laranja
'''

FLUENT = '''
Corações & Afeto|Red heart:Coração vermelho,Pink heart:Coração rosa,Orange heart:Coração laranja,Yellow heart:Coração amarelo,Green heart:Coração verde,Blue heart:Coração azul,Purple heart:Coração roxo,Black heart:Coração preto,White heart:Coração branco,Heart on fire:Coração em chamas,Sparkling heart:Coração brilhante,Beating heart:Coração pulsando,Heart with ribbon:Coração de presente,Two hearts:Dois corações
Estrelas & Destaques|Star:Estrela dourada,Glowing star:Estrela brilhante,Shooting star:Estrela cadente,Sparkles:Brilhos,Fire:Em alta,High voltage:Energia,Gem stone:Pedra preciosa,Crown:Coroa dourada
Prêmios & Conquistas|Trophy:Troféu dourado,1st place medal:Medalha de ouro,2nd place medal:Medalha de prata,3rd place medal:Medalha de bronze,Sports medal:Medalha esportiva,Military medal:Medalha de honra
Festas & Celebrações|Party popper:Lança confetes,Confetti ball:Confetes,Wrapped gift:Presente,Balloon:Balão de festa,Partying face:Clima de festa
Frutas & Legumes|Avocado:Abacate,Strawberry:Morango,Watermelon:Melancia,Mango:Manga,Pineapple:Abacaxi,Peach:Pêssego,Broccoli:Brócolis,Hot pepper:Pimenta
Sobremesas|Cupcake:Cupcake,Doughnut:Rosquinha,Cookie:Biscoito,Shortcake:Bolo de morango,Soft ice cream:Sorvete cremoso,Chocolate bar:Chocolate
Padaria & Café|Croissant:Croissant,Baguette bread:Baguete,Pancakes:Panquecas,Hot beverage:Bebida quente,Teapot:Bule de chá
Bebidas|Tropical drink:Drink tropical,Bubble tea:Chá com bolhas,Clinking beer mugs:Brinde de cerveja,Wine glass:Taça de vinho
Lanches|Sandwich:Sanduíche,Hot dog:Cachorro-quente,French fries:Batata frita,Taco:Taco
Japonês & Oriental|Sushi:Sushi,Steaming bowl:Lámen,Bento box:Bentô
Saudável & Veg|Green salad:Salada verde
Serviço & Entrega|Shopping bags:Sacolas de compras,Motor scooter:Motoneta,Package:Caixa de entrega
'''

# Additive selection: keep all previous IDs and artwork. The upstream revisions
# remain pinned in sources.json, including their original license notices.
CURATED += '''
Lanches|Lucide|hamburger:Hambúrguer em contorno,sandwich:Sanduíche em contorno,popcorn:Pipoca
Bebidas|Lucide|coffee:Xícara de café,cup-soda:Refrigerante com canudo,glass-water:Copo de água,milk:Caixa de leite,beer:Caneca de cerveja,bottle-wine:Garrafa de vinho
Sobremesas|Lucide|cake:Bolo de festa,cupcake:Cupcake em contorno,cookie:Biscoito artesanal,candy:Bala em contorno,candy-cane:Bengala doce,ice-cream-bowl:Sorvete na taça,ice-cream-cone:Sorvete na casquinha
Padaria & Café|Lucide|croissant:Croissant em contorno
Pratos & Carnes|Lucide|egg:Ovo,egg-fried:Ovo na frigideira,fish-symbol:Peixe simplificado
Saudável & Veg|Lucide|salad:Salada em contorno,wheat-off:Sem glúten,milk-off:Sem lactose
Pizzas & Massas|Lucide|pizza:Fatia de pizza
Utensílios & Cozinha|Lucide|blender:Liquidificador
Lanches|Tabler|burger:Hambúrguer em linhas
Bebidas|Tabler|milkshake:Milk-shake,glass-champagne:Taça de espumante,glass-gin:Taça de gin,glass-full:Copo cheio,glass:Copo em linhas,milk:Leite,cup:Copo para viagem
Sobremesas|Tabler|cake:Bolo em linhas,cake-roll:Rocambole,chocolate:Barra de chocolate,ice-cream-2:Picolé,cookie-man:Biscoito de gengibre
Pratos & Carnes|Tabler|sausage:Linguiça,eggs:Ovos,egg-cracked:Ovo quebrado,fish-bone:Espinha de peixe
Frutas & Legumes|Tabler|avocado:Abacate em linhas,apple:Maçã em linhas,banana:Banana em linhas,carrot:Cenoura em linhas,cherry:Cerejas em linhas,grape:Cacho de uvas,lemon:Limão,lemon-2:Fatia de limão,mushroom:Cogumelo,pepper:Pimenta em linhas
Saudável & Veg|Tabler|salad:Salada em linhas,wheat:Trigo em linhas,meat-off:Sem carne,milk-off:Sem leite,bread-off:Sem pão
Utensílios & Cozinha|Tabler|chef-hat:Chapéu de cozinheiro,blender:Liquidificador em linhas,fridge:Geladeira em linhas,whisk:Batedor de claras,grill-fork:Garfo de churrasco,grill-spatula:Espátula de churrasco,salt:Saleiro,bowl:Tigela
Lanches|Phosphor|hamburger:Hambúrguer clássico em linhas,popcorn:Pipoca em linhas
Bebidas|Phosphor|beer-bottle:Garrafa de cerveja,beer-stein:Caneca de chopp,pint-glass:Copo de chopp,coffee:Café em linhas
Sobremesas|Phosphor|cake:Bolo artesanal,cookie:Cookie em linhas,ice-cream:Sorvete em linhas
Padaria & Café|Phosphor|bread:Pão artesanal,coffee-bean:Grão de café
Pratos & Carnes|Phosphor|bowl-food:Prato de comida,bowl-steam:Tigela fumegante,fish-simple:Peixe em linhas,shrimp:Camarão em linhas,egg:Ovo em linhas,egg-crack:Ovo rachado
Pizzas & Massas|Phosphor|pizza:Pizza em linhas
Frutas & Legumes|Phosphor|avocado:Abacate artesanal,carrot:Cenoura artesanal,orange:Laranja,pepper:Pimenta artesanal
Utensílios & Cozinha|Phosphor|cheese:Queijo,chef-hat:Chapéu de chef em linhas
Serviço & Entrega|Lucide|shopping-cart:Carrinho de compras,notebook-pen:Anotar pedido,clipboard-list:Lista de pedidos,calendar-days:Agendamento,scan-line:Leitura de código,hand-coins:Pagamento,credit-card:Cartão,bell-ring:Pedido pronto
Serviço & Entrega|Tabler|moped:Entrega de moto,paper-bag:Sacola de papel,receipt:Recibo,truck-delivery:Delivery
Festas & Celebrações|Phosphor|confetti:Confetes em linhas,champagne:Brinde com espumante,balloon:Balão em linhas,gift:Presente em linhas
'''

FLUENT += '''
Lanches|Hamburger:Hambúrguer 3D,Burrito:Burrito,Popcorn:Pipoca,Stuffed flatbread:Pão recheado,Falafel:Falafel
Pratos & Carnes|Cut of meat:Corte de carne,Meat on bone:Carne com osso,Poultry leg:Coxa de frango,Bacon:Bacon,Egg:Ovo frito,Cooking:Frigideira,Shallow pan of food:Paella,Pot of food:Ensopado,Canned food:Comida enlatada
Frutos do Mar|Crab:Caranguejo,Lobster:Lagosta,Shrimp:Camarão,Fried shrimp:Camarão empanado,Squid:Lula,Oyster:Ostra
Pizzas & Massas|Pizza:Pizza 3D,Spaghetti:Espaguete
Japonês & Oriental|Dumpling:Guioza,Cooked rice:Arroz cozido,Curry rice:Arroz com curry,Rice ball:Bolinho de arroz,Rice cracker:Biscoito de arroz,Fish cake with swirl:Kamaboko,Chopsticks:Hashis
Sobremesas|Birthday cake:Bolo de aniversário,Pie:Torta,Candy:Bala,Lollipop:Pirulito,Ice cream:Sorvete na taça,Shaved ice:Raspadinha,Custard:Pudim,Honey pot:Pote de mel,Moon cake:Bolo da lua,Dango:Dango
Padaria & Café|Bread:Pão de forma,Flatbread:Pão sírio,Pretzel:Pretzel,Bagel:Bagel,Waffle:Waffle,Butter:Manteiga
Bebidas|Beer mug:Caneca de cerveja,Cocktail glass:Coquetel,Bottle with popping cork:Espumante,Glass of milk:Copo de leite,Cup with straw:Copo com canudo,Beverage box:Caixa de suco,Mate:Chimarrão,Teacup without handle:Chá verde,Sake:Saquê,Ice:Gelo
Frutas & Legumes|Banana:Banana,Grapes:Uvas,Red apple:Maçã vermelha,Green apple:Maçã verde,Pear:Pera,Tangerine:Tangerina,Lemon:Limão,Kiwi fruit:Kiwi,Cherries:Cerejas,Coconut:Coco,Melon:Melão,Tomato:Tomate,Carrot:Cenoura,Potato:Batata,Roasted sweet potato:Batata-doce assada,Ear of corn:Milho,Eggplant:Berinjela,Cucumber:Pepino,Leafy green:Folhas verdes,Bell pepper:Pimentão,Garlic:Alho,Onion:Cebola,Mushroom:Cogumelo,Peanuts:Amendoim,Chestnut:Castanha,Olive:Azeitona,Cheese wedge:Queijo
Utensílios & Cozinha|Fork and knife with plate:Prato e talheres,Fork and knife:Garfo e faca,Spoon:Colher,Kitchen knife:Faca de cozinha,Salt:Saleiro,Bowl with spoon:Tigela com colher
Serviço & Entrega|Shopping cart:Carrinho de compras,Delivery truck:Caminhão de entrega,Receipt:Comanda,Convenience store:Loja 24 horas,Bell:Sino de atendimento
Saudável & Veg|Potted plant:Planta em vaso,Seedling:Broto,Herb:Ervas frescas
'''

def safe_svg(data):
    root = ET.fromstring(data)
    allowed = {'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title'}
    for node in root.iter():
        node.tag = node.tag.rsplit('}', 1)[-1]
        if node.tag not in allowed:
            raise ValueError(f'Unsupported SVG element: {node.tag}')
        for attr, value in node.attrib.items():
            if attr.startswith('on') or attr in {'href', 'style'} or 'url(' in value or '<' in value:
                raise ValueError(f'Unsupported SVG attribute: {attr}')
    root.attrib.pop('class', None)
    return ET.tostring(root, encoding='unicode')

def vector(spec):
    group, source, key, label = spec
    repo = repos[source]
    if source == 'Lucide': path = f'icons/{key}.svg'
    elif source == 'Phosphor': path = f'assets/regular/{key}.svg'
    else: path = f'icons/{"filled" if key.endswith("-filled") else "outline"}/{key.removesuffix("-filled")}.svg'
    url = f'https://raw.githubusercontent.com/{repo}/{manifest[source]["commit"]}/{path}'
    return dict(id=f'2d-{source.lower()}-{key}', name=label, type='2d', group=group,
                tags=[key.replace('-', ' '), source, label], source=source, svg=safe_svg(fetch(url)))

tree = json.loads(fetch(f'https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/{manifest["Fluent Emoji"]["commit"]}?recursive=1'))
pngs = [entry['path'] for entry in tree['tree'] if '/3D/' in entry['path'] and entry['path'].endswith('.png')]

def three_d(spec):
    group, key, label = spec
    path = next(p for p in pngs if p.startswith(f'assets/{key}/3D/'))
    slug = re.sub('[^a-z0-9]+', '-', key.lower()).strip('-')
    filename = f'fluent-{slug}.png'
    url = f'https://raw.githubusercontent.com/microsoft/fluentui-emoji/{manifest["Fluent Emoji"]["commit"]}/{urllib.parse.quote(path)}'
    data = fetch(url)
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('Invalid PNG')
    (ASSETS / filename).write_bytes(data)
    svg = f'<svg viewBox="0 0 256 256"><image href="/assets/catalog/{filename}" width="256" height="256"/></svg>'
    return dict(id=f'3d-fluent-{slug}', name=label, type='3d', group=group, tags=[key, label, 'fluent', 'colorido'], source='Fluent Emoji', svg=svg)

vectors = [(group, source, *entry.split(':')) for line in CURATED.strip().splitlines()
           if line.strip()
           for group, source, entries in [line.split('|')] for entry in entries.split(',')]
sculpted = [(group, *entry.split(':')) for line in FLUENT.strip().splitlines()
            if line.strip()
            for group, entries in [line.split('|')] for entry in entries.split(',')]
icons, failures = [], []
with futures.ThreadPoolExecutor(max_workers=12) as pool:
    jobs = [(spec, pool.submit(vector, spec)) for spec in vectors] + [(spec, pool.submit(three_d, spec)) for spec in sculpted]
    for spec, job in jobs:
        try: icons.append(job.result())
        except Exception as error: failures.append((spec, str(error)))
if failures:
    print(json.dumps(failures, ensure_ascii=True)); raise SystemExit('Fix unavailable curated assets before regenerating.')
unique = {}
for icon in icons:
    unique.setdefault(icon['id'], icon)
icons = list(unique.values())
write_json(CONSTANTS / 'icon-catalog-extra.json', icons)
if '--catalog-only' in sys.argv:
    print(json.dumps({'icons': len(icons), '2d': sum(i['type'] == '2d' for i in icons),
                      '3d': sum(i['type'] == '3d' for i in icons)}, ensure_ascii=True))
    raise SystemExit(0)

package = json.loads(fetch('https://registry.npmjs.org/emojibase-data/17.0.0'))
archive = fetch(package['dist']['tarball'])
if 'sha512-' + __import__('base64').b64encode(hashlib.sha512(archive).digest()).decode() != package['dist']['integrity']:
    raise ValueError('Emoji package integrity mismatch')
tar = tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz')
records = json.load(tar.extractfile('package/pt/data.json'))
(ASSETS / 'licenses/emojibase.txt').write_bytes(tar.extractfile('package/LICENSE').read())
by_emoji = {}
for record in records:
    for item in [record, *record.get('skins', [])]:
        by_emoji[item['emoji']] = {**record, **item}
emoji_test = fetch('https://unicode.org/Public/17.0.0/emoji/emoji-test.txt').decode()
(ASSETS / 'licenses/unicode.txt').write_bytes(fetch('https://www.unicode.org/license.txt'))
(ASSETS / 'licenses/unicode.txt').write_bytes(fetch('https://www.unicode.org/license.txt'))
emojis = []
for line in emoji_test.splitlines():
    match = re.match(r'^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*\S+\s+E[\d.]+\s+(.+)$', line)
    if not match: continue
    glyph = ''.join(chr(int(code, 16)) for code in match[1].split())
    record = by_emoji.get(glyph, {})
    code = '-'.join(f'{ord(char):x}' for char in glyph)
    emojis.append([code, record.get('label', match[3]), record.get('group', 9), ' '.join(record.get('tags', []))])
write_json(ASSETS / 'emojis-pt.json', emojis)
codes = [entry[0] for entry in emojis]
write_json(CONSTANTS / 'emoji-codepoints.json', codes)
write_json(ROOT / 'backend/src/constants/emoji-codepoints.json', codes)
manifest['Emojibase'] = {'repository': 'https://github.com/milesj/emojibase', 'version': '17.0.0', 'integrity': package['dist']['integrity']}
manifest['Unicode'] = {'version': '17.0', 'source': 'https://unicode.org/Public/17.0.0/emoji/emoji-test.txt', 'sha256': hashlib.sha256(emoji_test.encode()).hexdigest()}
write_json(manifest_path, manifest)
print(json.dumps({'newIcons': len(icons), 'emojis': len(emojis), 'groups': sorted(set(i['group'] for i in icons))}, ensure_ascii=True))
