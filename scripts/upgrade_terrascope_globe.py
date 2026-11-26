import re
import json

def upgrade_index_html():
    with open('web/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add 3D Tilt button to .view-controls
    old_view_controls = '''        <div class="view-controls">
          <button class="ctrl-btn compass-icon" title="Reset North" onclick="resetGlobeView()">🧭</button>
          <button class="ctrl-btn" id="btnRotation" title="Enable Auto-Rotation (Optional)" onclick="toggleGlobeRotation()">▶️</button>
          <button class="ctrl-btn" title="Zoom In" onclick="zoomGlobe(1)">+</button>
          <button class="ctrl-btn" title="Zoom Out" onclick="zoomGlobe(-1)">−</button>
          <button class="ctrl-btn mode-pill" id="btn2D3D" title="Toggle 2D / 3D Engine" onclick="toggleEngine2D3D()">2D</button>
        </div>'''

    new_view_controls = '''        <div class="view-controls">
          <button class="ctrl-btn compass-icon" title="Reset North & Level Camera" onclick="resetGlobeView()">🧭</button>
          <button class="ctrl-btn" id="btnTilt" title="Toggle 3D Horizon Tilt (Google Earth View)" onclick="toggleCameraTilt()">📐</button>
          <button class="ctrl-btn" id="btnRotation" title="Enable Auto-Rotation (Optional)" onclick="toggleGlobeRotation()">▶️</button>
          <button class="ctrl-btn" title="Zoom In" onclick="zoomGlobe(1)">+</button>
          <button class="ctrl-btn" title="Zoom Out" onclick="zoomGlobe(-1)">−</button>
          <button class="ctrl-btn mode-pill" id="btn2D3D" title="Toggle 2D Map / 3D Globe" onclick="toggleEngine2D3D()">2D</button>
        </div>'''

    if old_view_controls in html:
        html = html.replace(old_view_controls, new_view_controls)
        print("Updated view-controls HTML with 3D Tilt button.")
    else:
        print("view-controls pattern not exact, attempting regex replacement...")
        html = re.sub(
            r'<div class="view-controls">.*?</div>\s*</section>',
            new_view_controls + '\n      </section>',
            html,
            flags=re.DOTALL
        )

    # 2. Update CSS for screen markers to ensure smooth positioning
    marker_css_pattern = r'/\* Overlaid HUD Labels on Globe \*/.*?(?=/\* Top-Right Globe Action Controls \*/)'
    new_marker_css = '''/* Overlaid HUD Labels & Hazards on 3D Globe */
    .hud-india {
      position: absolute;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 2.5px;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 0 10px rgba(0, 0, 0, 0.95), 0 0 18px rgba(56, 189, 248, 0.85);
      pointer-events: none;
      z-index: 20;
      transform: translate(-50%, -50%);
      transition: opacity 0.15s ease;
      will-change: left, top;
    }
    .hud-telangana {
      position: absolute;
      background: rgba(147, 51, 234, 0.35);
      border: 1.5px solid #c084fc;
      border-radius: 5px;
      padding: 3px 8px;
      font-weight: 700;
      font-size: 11px;
      color: #f1f5f9;
      pointer-events: auto;
      cursor: pointer;
      z-index: 21;
      box-shadow: 0 0 14px rgba(192, 132, 252, 0.5);
      transform: translate(-50%, -50%);
      transition: all 0.2s ease;
      will-change: left, top;
    }
    .hud-telangana:hover {
      background: rgba(147, 51, 234, 0.6);
      transform: translate(-50%, -50%) scale(1.08);
    }

    /* Floating Hazard & Vehicle Entities anchored in 3D */
    .globe-marker-fire {
      position: absolute; font-size: 20px; filter: drop-shadow(0 0 10px #ef4444);
      z-index: 25; cursor: pointer; animation: flameBounce 1.5s infinite alternate ease-in-out;
      transform: translate(-50%, -50%); will-change: left, top;
    }
    @keyframes flameBounce { 0% { transform: translate(-50%, -50%) scale(1); } 100% { transform: translate(-50%, -55%) scale(1.15); } }

    .globe-marker-rain { position: absolute; font-size: 18px; filter: drop-shadow(0 0 8px #38bdf8); z-index: 25; transform: translate(-50%, -50%); will-change: left, top; }
    .globe-marker-plane { position: absolute; font-size: 16px; filter: drop-shadow(0 0 6px white); z-index: 25; transform: translate(-50%, -50%) rotate(-35deg); will-change: left, top; }
    .globe-marker-ship { position: absolute; font-size: 15px; filter: drop-shadow(0 0 6px #38bdf8); z-index: 25; transform: translate(-50%, -50%); will-change: left, top; }
    .globe-marker-cyclone { position: absolute; font-size: 22px; filter: drop-shadow(0 0 12px #f59e0b); z-index: 25; cursor: pointer; transform: translate(-50%, -50%); will-change: left, top; }
    
    '''

    html = re.sub(marker_css_pattern, new_marker_css, html, flags=re.DOTALL)
    print("Updated marker CSS.")

    with open('web/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Wrote initial updates to web/index.html.")

if __name__ == '__main__':
    upgrade_index_html()
