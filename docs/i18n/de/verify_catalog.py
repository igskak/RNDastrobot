"""Validate the editorial artifact; this does not measure linguistic quality."""
import hashlib
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_text())


def flatten(value, prefix=''):
    if not isinstance(value, dict):
        return {prefix: value}
    result = {}
    for key, nested in value.items():
        result.update(flatten(nested, f'{prefix}.{key}' if prefix else key))
    return result


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.events = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.events.append(('start', tag, sorted(attrs)))

    def handle_endtag(self, tag):
        self.events.append(('end', tag))

    def handle_startendtag(self, tag, attrs):
        self.events.append(('self', tag, sorted(attrs)))


def tokens(text):
    return Counter(re.findall(r'\{([A-Za-z0-9_]+)\}', text))


def main():
    source = read('translation-source.json')
    ledger = read('review-ledger.json')
    target = flatten(read('de.editorial.json'))
    rows = {r['key']: r for b in source['batches'] for r in b['entries']}
    alternate = set(ledger['alternate_source_ru_keys'])
    errors = []
    if set(rows) != set(target):
        errors.append('Key sets differ')
    reviewed = [k for b in ledger['reviewed_batches'] for k in b['keys']]
    if Counter(reviewed) != Counter(target.keys()):
        errors.append('Review ledger does not cover every key exactly once')
    for batch in ledger['reviewed_batches']:
        if batch['status'] != 'editorially_reviewed' or batch['count'] != len(batch['keys']):
            errors.append('Incomplete review batch: ' + batch['id'])
    for key, row in rows.items():
        value = target.get(key)
        if not isinstance(value, str):
            errors.append(key + ': not a string')
            continue
        if not value.strip() and key not in ledger['empty_by_design']:
            errors.append(key + ': unexpected empty value')
        if tokens(row['en']) != tokens(value):
            errors.append(key + ': placeholder mismatch')
        reference = row['ru_context'] if key in alternate else row['en']
        if Markup(reference).events != Markup(value).events:
            errors.append(key + ': HTML structure/attribute mismatch')
        if re.search(r'[А-Яа-яІіЇїЄєҐґ]', value):
            errors.append(key + ': Cyrillic text')
        if re.fullmatch(r'(Text|Title|Item)\d*', value):
            errors.append(key + ': untranslated stub')
        if re.search(r'\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)\b', value, re.I):
            errors.append(key + ': informal address candidate')
        if key.startswith(('page.legal.', 'page.pricing.')):
            if Counter(re.findall(r'\d+', row['en'])) != Counter(re.findall(r'\d+', value)):
                errors.append(key + ': legal/pricing numeric mismatch')
    identical = {k: v for k, v in target.items() if v == rows[k]['en']}
    approved = {r['key']: r['value'] for r in read('identical-values.de.json')['entries']}
    if identical != approved:
        errors.append('Identical EN/DE values differ from editorially approved list')
    catalog_hash = hashlib.sha256((ROOT / 'de.editorial.json').read_bytes()).hexdigest()
    if catalog_hash != ledger['catalog_sha256']:
        errors.append('Catalog changed after the recorded review')
    result = {
        'ok': not errors,
        'catalog_keys': len(target),
        'reviewed_batches': len(ledger['reviewed_batches']),
        'approved_identical_values': len(identical),
        'ru_source_repairs': len(alternate),
        'intentional_empty_values': ledger['empty_by_design'],
        'errors': errors,
        'scope': 'Artifact structure; model editorial review recorded separately; no native-speaker or browser verification',
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == '__main__':
    raise SystemExit(main())
