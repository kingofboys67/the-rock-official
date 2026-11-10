"""Adds detail-page data to media/movies.json (run after build-movies.py):

  - imdb:      IMDb title ID (Wikidata P345)
  - posterHD:  full-resolution official poster (~1000x1500) from IMDb's public title suggestion endpoint,
               matched by exact IMDb ID. The page falls back to the Wikipedia poster, then a typographic one.
  - director:  Wikidata P57
  - runtime:   minutes, Wikidata P2047
  - rating:    MPA rating, Wikidata P1657 (e.g. PG-13)
  - cast:      up to 6 co-stars with their characters, parsed from the film's Wikipedia "Cast" section

usage: python3 scripts/enrich-movies.py      (standard library only; needs network)
"""
import json, re, time, urllib.parse, urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'the-rock-fan-site/1.0 (personal, non-commercial; movie detail builder)'}


def get(url, params=None, tries=5):
    if params: url += '?' + urllib.parse.urlencode(params)
    for a in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or a == tries - 1: raise
            time.sleep(6 * (a + 1))


def wd_entities(ids, props='claims'):
    out = {}
    for i in range(0, len(ids), 40):
        d = get('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'format': 'json', 'ids': '|'.join(ids[i:i + 40]),
                                                        'props': props, 'languages': 'en'})
        out.update(d['entities']); time.sleep(1)
    return out


def val(c):
    return c.get('mainsnak', {}).get('datavalue', {}).get('value')


def imdb_poster(tt):
    try:
        d = get(f'https://v3.sg.media-imdb.com/suggestion/x/{tt}.json')
    except Exception:
        return None
    for r in d.get('d', []):
        if r.get('id') == tt and r.get('i', {}).get('imageUrl'):
            return r['i']['imageUrl']
    return None


def strip_wiki(s):
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'{2,}", '', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def cast_from_wiki(title):
    """First top-level bullet entries of the Cast section: '* [[Actor]] as Role, ...'."""
    try:
        d = get('https://en.wikipedia.org/w/api.php', {'action': 'parse', 'format': 'json', 'page': title, 'prop': 'wikitext', 'redirects': 1})
    except Exception:
        return []
    w = d.get('parse', {}).get('wikitext', {}).get('*', '')
    m = re.search(r'^==\s*(?:Main |Voice )?[Cc]ast(?: and characters| members)?\s*==\s*$(.*?)(?=^==[^=])', w, flags=re.M | re.S)
    if not m: return []
    out = []
    for line in m.group(1).splitlines():
        if not re.match(r'^\*(?!\*)', line): continue  # top-level bullets only ('*' with or without a space)
        line = re.sub(r'\s*\([^)]*\)', '', strip_wiki(line[1:]))  # drop '(credited as …)' style notes
        mm = re.match(r'^(.+?)\s+as\s+(.+)$', line)
        if not mm: continue
        actor = mm.group(1).strip(' :')
        rest = re.sub(r'\b(Dr|Mrs|Mr|Ms|Det|Capt|Lt|Sgt|St|Jr|Prof|Gen|Col|Agt)\.', r'\1§', mm.group(2))  # keep titles whole
        role = re.split(r'[,;:.]| – | — | - ', rest)[0].replace('§', '.').strip()
        voice = re.match(r'^the voice of (.+)$', role, flags=re.I)
        if voice: role = voice.group(1) + ' (voice)'
        if not actor or not role or len(actor) > 40 or len(role) > 60: continue
        out.append({'actor': actor, 'role': role})
    return out


def main():
    films = json.loads((SITE / 'media/movies.json').read_text())
    # film QIDs again (via the Wikipedia article)
    titles = [f['wikiUrl'].rsplit('/', 1)[1] for f in films if f.get('wikiUrl')]
    qid_of = {}
    for i in range(0, len(titles), 20):
        chunk = [urllib.parse.unquote(t).replace('_', ' ') for t in titles[i:i + 20]]
        d = get('https://en.wikipedia.org/w/api.php', {'action': 'query', 'format': 'json', 'titles': '|'.join(chunk),
                                                       'prop': 'pageprops', 'ppprop': 'wikibase_item'})
        for p in d['query']['pages'].values():
            qid_of[p['title']] = p.get('pageprops', {}).get('wikibase_item')
        time.sleep(1)
    ents = wd_entities(sorted({q for q in qid_of.values() if q}))
    ref_ids = set()
    for e in ents.values():
        for pid in ('P57', 'P1657'):
            for c in e.get('claims', {}).get(pid, []):
                v = val(c)
                if isinstance(v, dict) and v.get('id'): ref_ids.add(v['id'])
    lab = {k: v.get('labels', {}).get('en', {}).get('value') for k, v in wd_entities(sorted(ref_ids), 'labels').items()}

    report = []
    for f in films:
        title = urllib.parse.unquote(f['wikiUrl'].rsplit('/', 1)[1]).replace('_', ' ') if f.get('wikiUrl') else None
        e = ents.get(qid_of.get(title)) if title else None
        c = (e or {}).get('claims', {})
        f['imdb'] = next((val(x) for x in c.get('P345', []) if val(x)), None)
        f['director'] = [lab.get(val(x)['id']) for x in c.get('P57', []) if isinstance(val(x), dict) and lab.get(val(x)['id'])] or None
        f['runtime'] = next((int(float(val(x)['amount'])) for x in c.get('P2047', []) if isinstance(val(x), dict) and val(x).get('unit', '').endswith('Q7727')), None)
        f['rating'] = next((lab.get(val(x)['id']) for x in c.get('P1657', []) if isinstance(val(x), dict)), None)
        if f['rating']: f['rating'] = f['rating'].replace('MPA rating ', '').replace('MPAA rating ', '').strip()
        f['posterHD'] = imdb_poster(f['imdb']) if f['imdb'] else None
        time.sleep(.4)
        cast = [x for x in (cast_from_wiki(title) if title else []) if 'dwayne johnson' not in x['actor'].lower()]
        f['cast'] = cast[:6]
        time.sleep(.4)
        report.append(f"{f['year']} {f['title'][:30]:30} imdb={f['imdb'] or '-':10} hd={'Y' if f['posterHD'] else '-'} dir={(f['director'] or ['-'])[0][:18]:18} "
                      f"rt={f['runtime'] or '-'} rating={f['rating'] or '-'} cast={len(f['cast'])}")
    (SITE / 'media/movies.json').write_text(json.dumps(films, ensure_ascii=False, indent=1))
    print('\n'.join(report))


if __name__ == '__main__':
    main()
