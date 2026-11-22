import base64
import os

with open('web/assets/earth-blue-marble.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

content = 'window.EARTH_BLUE_MARBLE_B64 = "data:image/jpeg;base64,' + b64 + '";\n'

with open('web/assets/earth-texture-data.js', 'w', encoding='utf-8') as out:
    out.write(content)

os.makedirs('gods-eye-view/public/assets', exist_ok=True)
with open('gods-eye-view/public/assets/earth-texture-data.js', 'w', encoding='utf-8') as out:
    out.write(content)

print('Generated earth-texture-data.js successfully!')
