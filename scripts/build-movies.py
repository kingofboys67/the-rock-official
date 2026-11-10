"""Builds media/movies.json for movies.html.

Hand-written data (role, genre, synopsis, tag, ranking) lives in scripts/films.json. This script adds,
from Wikipedia and Wikidata, for each film:
  - poster:     the poster image from the film's Wikipedia article (hot-linked thumbnail)
  - wiki:       article URL
  - trailer:    YouTube video ID of the official trailer: Wikidata's (P1651), a hand-picked trailerAlt, or the first
                YouTube search result from a studio/trusted trailer channel (trailerChannel records which);
                kept only if YouTube reports it playable when embedded
  - rt:         Rotten Tomatoes score, when Wikidata records one (P444 reviewed by Q105584)
  - gross:      highest worldwide box-office figure in USD, when recorded (P2142)
  - castCheck:  whether Dwayne Johnson (Q10738) is in the film's cast list (P161) and the character recorded
Box office missing from Wikidata can be supplied by hand as grossManual (from the film's article).
Anything else missing stays null; the page falls back gracefully (typographic poster, YouTube search link).

usage: python3 scripts/build-movies.py      (standard library only; needs network)
"""
import json, re, time, urllib.parse, urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'the-rock-fan-site/1.0 (personal, non-commercial; movie list builder)'}
ROCK, RT = 'Q10738', 'Q105584'


def get(url, params=None, tries=5):
    if params: url += '?' + urllib.parse.urlencode(params)
    for a in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code != 429 or a == tries - 1: raise
            time.sleep(6 * (a + 1))


def wiki_pages(titles):
    """title -> {pageid, title, qid, poster} via the Wikipedia API (redirects followed)."""
    out = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        d = get('https://en.wikipedia.org/w/api.php', {
            'action': 'query', 'format': 'json', 'redirects': 1, 'titles': '|'.join(chunk),
            'prop': 'pageprops|pageimages', 'ppprop': 'wikibase_item', 'piprop': 'thumbnail', 'pithumbsize': 600,
            'pilicense': 'any'})  # posters are non-free images; without this the API skips them
        q = d['query']
        alias = {r['from']: r['to'] for r in q.get('redirects', [])}
        alias.update({n['from']: n['to'] for n in q.get('normalized', [])})
        by = {p['title']: p for p in q['pages'].values()}
        for t in chunk:
            tt = alias.get(t, t); tt = alias.get(tt, tt)
            p = by.get(tt)
            if not p or 'missing' in p: out[t] = None; continue
            out[t] = {'title': p['title'], 'qid': p.get('pageprops', {}).get('wikibase_item'),
                      'poster': p.get('thumbnail', {}).get('source')}
        time.sleep(1)
    return out


def wikidata(qids):
    out = {}
    for i in range(0, len(qids), 40):
        d = get('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'format': 'json',
                                                        'ids': '|'.join(qids[i:i + 40]), 'props': 'claims'})
        out.update(d['entities']); time.sleep(1)
    return out


def claims(ent, pid):
    return ent.get('claims', {}).get(pid, [])


def val(c):
    return c.get('mainsnak', {}).get('datavalue', {}).get('value')


def extract(ent, labels):
    yt = [val(c) for c in claims(ent, 'P1651') if val(c)]
    rt = None
    for c in claims(ent, 'P444'):
        by = [q['datavalue']['value']['id'] for q in c.get('qualifiers', {}).get('P447', []) if 'datavalue' in q]
        v = val(c)
        if RT in by and isinstance(v, str) and v.endswith('%'):
            rt = v  # last listed wins (Wikidata tends to append newer scores)
    gross = None
    for c in claims(ent, 'P2142'):
        v = val(c)
        if isinstance(v, dict) and v.get('unit', '').endswith('Q4917'):  # US dollar
            amt = float(v['amount'])
            gross = max(gross or 0, amt)
    cast, chars = False, []
    for c in claims(ent, 'P161'):
        v = val(c)
        if isinstance(v, dict) and v.get('id') == ROCK:
            cast = True
            for q in c.get('qualifiers', {}).get('P453', []):
                if 'datavalue' in q: chars.append(q['datavalue']['value']['id'])
            for q in c.get('qualifiers', {}).get('P4633', []):  # name of the character role (string)
                if 'datavalue' in q: chars.append(q['datavalue']['value'])
    voice = any(val(c) and val(c).get('id') == ROCK for c in claims(ent, 'P725'))  # voice actor
    return {'trailer': yt[0] if yt else None, 'rt': rt, 'gross': gross, 'castCheck': cast or voice, 'chars': chars}


BROWSER = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
           'Accept-Language': 'en-US,en;q=0.9'}


def trailer_ok(vid):
    """True if YouTube reports the video playable AND playable when embedded on other sites.
    (oEmbed alone is not enough: region-blocked or removed studio uploads still answer it.)"""
    try:
        h = urllib.request.urlopen(urllib.request.Request(f'https://www.youtube.com/watch?v={vid}', headers=BROWSER), timeout=30).read().decode('utf-8', 'ignore')
    except Exception:
        return False
    return '"playabilityStatus":{"status":"OK"' in h and '"playableInEmbed":true' in h


TRUSTED = ('universal pictures', 'sony pictures', 'warner bros', 'walt disney', 'disney', 'paramount', 'netflix', 'a24',
           'lionsgate', 'mgm', '20th century', 'columbia pictures', 'screen gems', 'summit entertainment', 'dreamworks',
           'movieclips', 'rotten tomatoes', 'filmselect', 'fandango', 'imdb', 'ign', 'fast & furious', 'jumanji', 'tyler perry',
           'focus features', 'new line', 'legendary', 'wwe', 'seven bucks', 'hbo', 'amazon mgm', 'prime video', 'bleecker street')


def find_trailer(title, year):
    """YouTube search fallback: first result whose title says 'trailer' and names the film, from a studio or
    trusted trailer channel, that is playable when embedded. Returns (video_id, channel) or (None, None)."""
    q = urllib.parse.urlencode({'search_query': f'{title} {year} official trailer'})
    try:
        h = urllib.request.urlopen(urllib.request.Request(f'https://www.youtube.com/results?{q}', headers=BROWSER), timeout=30).read().decode('utf-8', 'ignore')
    except Exception:
        return None, None
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', h)
    if not m: return None, None
    data = json.loads(m.group(1))
    vids = []
    def walk(o):
        if isinstance(o, dict):
            if 'videoRenderer' in o: vids.append(o['videoRenderer'])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(data)
    key = re.sub(r'[^a-z0-9 ]', '', title.lower().split(':')[0]).strip()
    for v in vids[:12]:
        t = ''.join(r.get('text', '') for r in v.get('title', {}).get('runs', [])).lower()
        ch = ''.join(r.get('text', '') for r in v.get('ownerText', {}).get('runs', []))
        if 'trailer' not in t or key not in re.sub(r'[^a-z0-9 ]', '', t): continue
        if not any(k in ch.lower() for k in TRUSTED): continue
        if trailer_ok(v['videoId']): return v['videoId'], ch
        time.sleep(.5)
    return None, None


def main():
    films = json.loads((SITE / 'scripts/films.json').read_text())
    pages = wiki_pages([f['wiki'] for f in films])
    qids = sorted({p['qid'] for p in pages.values() if p and p.get('qid')})
    ents = wikidata(qids)
    # character items -> labels
    char_ids = sorted({c for e in ents.values() for c in extract(e, {})['chars'] if isinstance(c, str) and c.startswith('Q')})
    labels = {}
    for i in range(0, len(char_ids), 40):
        d = get('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'format': 'json', 'ids': '|'.join(char_ids[i:i + 40]),
                                                        'props': 'labels', 'languages': 'en'})
        labels.update({k: v.get('labels', {}).get('en', {}).get('value') for k, v in d['entities'].items()})
    out, report = [], []
    for f in films:
        p = pages.get(f['wiki'])
        row = dict(f)
        row.update({'poster': None, 'wikiUrl': None, 'trailer': None, 'rt': None, 'gross': None, 'castCheck': None, 'wdChars': []})
        if p:
            row['poster'] = p['poster'].split('?')[0] if p['poster'] else None  # drop the API's tracking query
            row['wikiUrl'] = 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(p['title'].replace(' ', '_'))
            e = ents.get(p['qid']) if p.get('qid') else None
            if e:
                x = extract(e, labels)
                row.update({k: x[k] for k in ('trailer', 'rt', 'gross', 'castCheck')})
                row['wdChars'] = [labels.get(c, c) for c in x['chars']]
        if not row['gross'] and f.get('grossManual'):  # figure from the film's Wikipedia article when Wikidata has none
            row['gross'] = f['grossManual']
        # first playable candidate wins: Wikidata's ID, then a hand-picked backup (trailerAlt)
        cands = [c for c in (row['trailer'], f.get('trailerAlt')) if c]
        row['trailer'] = next((c for c in cands if trailer_ok(c)), None)
        if cands and not row['trailer']:
            row['deadTrailer'] = cands
        if not row['trailer'] and not f.get('upcomingNoTrailer'):
            row['trailer'], row['trailerChannel'] = find_trailer(f['title'], f['year']); time.sleep(1)
        out.append(row)
        report.append(f"{f['year']} {f['title'][:34]:34} page={'Y' if p else '-'} poster={'Y' if row['poster'] else '-'} "
                      f"cast={row['castCheck']} yt={row['trailer'] or '-'} rt={row['rt'] or '-'} gross={int(row['gross']) if row['gross'] else '-'} chars={row['wdChars']}")
    (SITE / 'media/movies.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print('\n'.join(report))


if __name__ == '__main__':
    main()
