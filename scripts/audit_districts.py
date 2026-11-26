import json

with open('data/raw/telangana_districts.geojson', 'r', encoding='utf-8') as f:
    gj = json.load(f)

print('Feature count:', len(gj['features']))
districts = []
for f in gj['features']:
    p = f['properties']
    districts.append({
        'dtname': p.get('dtname'),
        'dist_lgd': p.get('Dist_LGD'),
        'stname': p.get('stname')
    })

districts.sort(key=lambda x: str(x['dtname']))
for d in districts:
    print(f"{d['dist_lgd']}: {d['dtname']}")

lgds = [d['dist_lgd'] for d in districts]
print('Total LGDs:', len(lgds), 'Unique LGDs:', len(set(lgds)))
