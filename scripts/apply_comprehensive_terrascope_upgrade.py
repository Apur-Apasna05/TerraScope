import re
import json

def apply_full_upgrade():
    with open('web/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Update View Controls HTML
    old_controls = """        <div class="view-controls">
          <button class="ctrl-btn compass-icon" title="Reset North" onclick="resetGlobeView()">🧭</button>
          <button class="ctrl-btn" id="btnRotation" title="Enable Auto-Rotation (Optional)" onclick="toggleGlobeRotation()">▶️</button>
          <button class="ctrl-btn" title="Zoom In" onclick="zoomGlobe(1)">+</button>
          <button class="ctrl-btn" title="Zoom Out" onclick="zoomGlobe(-1)">−</button>
          <button class="ctrl-btn mode-pill" id="btn2D3D" title="Toggle 2D / 3D Engine" onclick="toggleEngine2D3D()">2D</button>
        </div>"""

    new_controls = """        <div class="view-controls">
          <button class="ctrl-btn compass-icon" title="Reset North & Level View" onclick="resetGlobeView()">🧭</button>
          <button class="ctrl-btn" id="btnTilt" title="Toggle 3D Horizon Tilt (Curvature View)" onclick="toggleCameraTilt()">📐</button>
          <button class="ctrl-btn" id="btnRotation" title="Enable Auto-Rotation (Optional)" onclick="toggleGlobeRotation()">▶️</button>
          <button class="ctrl-btn" title="Zoom In" onclick="zoomGlobe(1)">+</button>
          <button class="ctrl-btn" title="Zoom Out" onclick="zoomGlobe(-1)">−</button>
          <button class="ctrl-btn mode-pill" id="btn2D3D" title="Toggle 2D Map / 3D Globe" onclick="toggleEngine2D3D()">2D</button>
        </div>"""

    if old_controls in html:
        html = html.replace(old_controls, new_controls)
        print("Updated .view-controls.")
    else:
        # fallback regex
        html = re.sub(r'<div class="view-controls">.*?</div>\s*</section>', new_controls + '\n      </section>', html, flags=re.DOTALL)
        print("Regex replaced .view-controls.")

    # 2. Update CSS for screen markers
    css_target = """    /* Overlaid HUD Labels on Globe */
    .hud-india {
      position: absolute;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 2px;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 0 8px rgba(0, 0, 0, 0.9), 0 0 14px rgba(56, 189, 248, 0.8);
      pointer-events: none;
      z-index: 20;
    }
    .hud-telangana {
      position: absolute;
      background: rgba(147, 51, 234, 0.25);
      border: 1.5px solid #c084fc;
      border-radius: 4px;
      padding: 2px 6px;
      font-weight: 700;
      font-size: 10.5px;
      color: #f1f5f9;
      pointer-events: auto;
      cursor: pointer;
      z-index: 21;
      box-shadow: 0 0 10px rgba(192, 132, 252, 0.4);
      transition: all 0.2s ease;
    }
    .hud-telangana:hover {
      background: rgba(147, 51, 234, 0.45);
      border-color: #e9d5ff;
      transform: scale(1.05);
    }

    /* Floating Hazard & Vehicle Entities */
    .globe-marker-fire {
      position: absolute; font-size: 18px; filter: drop-shadow(0 0 8px #ef4444);
      z-index: 25; cursor: pointer; animation: flameBounce 1.5s infinite alternate ease-in-out;
    }
    @keyframes flameBounce { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-3px) scale(1.1); } }

    .globe-marker-rain { position: absolute; font-size: 16px; filter: drop-shadow(0 0 6px #38bdf8); z-index: 25; }
    .globe-marker-plane { position: absolute; font-size: 14px; filter: drop-shadow(0 0 4px white); z-index: 25; transform: rotate(-35deg); }
    .globe-marker-ship { position: absolute; font-size: 14px; filter: drop-shadow(0 0 4px #38bdf8); z-index: 25; }
    .globe-marker-cyclone { position: absolute; font-size: 20px; filter: drop-shadow(0 0 10px #f59e0b); z-index: 25; cursor: pointer; }"""

    css_replacement = """    /* Overlaid HUD Labels & Hazards on 3D Globe (Surface-Tracked) */
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
    .globe-marker-cyclone { position: absolute; font-size: 22px; filter: drop-shadow(0 0 12px #f59e0b); z-index: 25; cursor: pointer; transform: translate(-50%, -50%); will-change: left, top; }"""

    if css_target in html:
        html = html.replace(css_target, css_replacement)
        print("Updated Marker CSS via exact match.")
    else:
        print("Marker CSS exact match not found, checking regex...")
        html = re.sub(r'/\* Overlaid HUD Labels on Globe \*/.*?(?=/\* Top-Right Globe Action Controls \*/)', css_replacement + '\n\n      ', html, flags=re.DOTALL)

    # 3. Upgrade JavaScript: Three.js initialization, Orbit/Tilt controls, 3D boundaries, and markers
    # Find the block starting at `// 3. Three.js Photorealistic NASA Blue Marble 3D Globe`
    # up to `// -------------------------------------------------------------------------`
    # `// CCTV Camera Intelligence & Viewshed Frustums`
    js_section_regex = r'(// 3\. Three\.js Photorealistic NASA Blue Marble 3D Globe & CCTV Intelligence\s*// -{70,}.*?)(function cameraHue\(index\))'

    new_threejs_engine = '''// 3. Three.js Photorealistic NASA Blue Marble 3D Globe & CCTV Intelligence
    // -------------------------------------------------------------------------
    let scene, camera, renderer, globeMesh, cloudsMesh, atmosphereMesh;
    let indiaBoundaryMesh = null, telanganaBoundaryGroup = null, flood3DMesh = null;
    let raycaster = new THREE.Raycaster();
    let mouseVector = new THREE.Vector2();
    let targetRotationY = -1.38;
    let targetRotationX = 0.32;
    let isDragging = false;
    let isRightDragging = false;
    let prevMouseX = 0, prevMouseY = 0;
    let mouseDragDistance = 0;

    // Advanced 3D Camera Controller (Google Earth / Cesium style Tilt & Zoom)
    let cameraDistance = 2.45;
    let targetCameraDistance = 2.45;
    let cameraPitch = 0.0;        // 0.0 = top-down, 0.72 = 41 deg oblique horizon tilt
    let targetCameraPitch = 0.0;

    // CCTV & Exploration Scope State (God's Eye View Integration)
    let currentScope = 'global';
    let activeCctvCameraId = null;
    let isFrustumVisible = true;
    let cctvMeshGroup = null;
    let cctvMarkerPins = [];
    let cctvFrustumMeshes = [];
    let cctvRefreshTimer = null;
    let hlsInstance = null;

    function initThreeGlobe() {
      const canvas = document.getElementById('globeCanvas');
      const container = canvas.parentElement;
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
      camera.position.set(0, 0, cameraDistance);

      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Oblique Directional Sun Light creating authentic day/night terminator
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
      sunLight.position.set(-4.5, 2.5, 3.5);
      scene.add(sunLight);

      // Subtle atmospheric ambient light
      const ambientLight = new THREE.AmbientLight(0x1a263d, 0.45);
      scene.add(ambientLight);

      // Authentic 3D Atmospheric Fresnel Rayleigh Scattering Halo
      const atmosphereGeo = new THREE.SphereGeometry(0.895, 64, 64);
      const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.6);
            gl_FragColor = vec4(0.25, 0.72, 0.98, 1.0) * intensity * 1.5;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
      });
      atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
      scene.add(atmosphereMesh);

      // Load NASA Blue Marble + Topology Relief Textures
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      function loadGlobeTexture() {
        const localDay = (window.location.protocol === 'file:') ? 'assets/earth-blue-marble.jpg' : '/assets/earth-blue-marble.jpg';
        const localTopo = (window.location.protocol === 'file:') ? 'assets/earth-topology.png' : '/assets/earth-topology.png';
        const cdnDay = 'https://unpkg.com/three-globe@2.45.6/example/img/earth-blue-marble.jpg';
        const cdnTopo = 'https://unpkg.com/three-globe@2.45.6/example/img/earth-topology.png';

        if (window.EARTH_BLUE_MARBLE_B64) {
          loader.load(window.EARTH_BLUE_MARBLE_B64, function(tex) {
            loader.load(localTopo, function(topo) {
              setupGlobeWithTexture(tex, topo);
            }, undefined, function() {
              setupGlobeWithTexture(tex, null);
            });
          });
          return;
        }

        loader.load(
          localDay,
          function(texture) {
            loader.load(localTopo, function(topo) {
              setupGlobeWithTexture(texture, topo);
            }, undefined, function() {
              setupGlobeWithTexture(texture, null);
            });
          },
          undefined,
          function(err) {
            loader.load(cdnDay, function(cdnTex) {
              setupGlobeWithTexture(cdnTex, null);
            });
          }
        );
      }
      loadGlobeTexture();

      function setupGlobeWithTexture(earthDayTexture, topoTexture) {
        earthDayTexture.wrapS = THREE.RepeatWrapping;
        earthDayTexture.wrapT = THREE.ClampToEdgeWrapping;

        const earthGeo = new THREE.SphereGeometry(0.85, 64, 64);
        const matConfig = {
          map: earthDayTexture,
          shininess: 25,
          specular: new THREE.Color(0x38bdf8)
        };
        if (topoTexture) {
          topoTexture.wrapS = THREE.RepeatWrapping;
          topoTexture.wrapT = THREE.ClampToEdgeWrapping;
          matConfig.bumpMap = topoTexture;
          matConfig.bumpScale = 0.026;
        }

        const earthMaterial = new THREE.MeshPhongMaterial(matConfig);

        globeMesh = new THREE.Mesh(earthGeo, earthMaterial);
        globeMesh.rotation.y = targetRotationY;
        globeMesh.rotation.x = targetRotationX;
        scene.add(globeMesh);

        // Add Realistic 3D Cloud Layer
        const cloudsGeo = new THREE.SphereGeometry(0.865, 48, 48);
        const cloudsCanvas = createDynamicCloudCanvas();
        const cloudsTex = new THREE.CanvasTexture(cloudsCanvas);
        const cloudsMaterial = new THREE.MeshLambertMaterial({
          map: cloudsTex,
          transparent: true,
          opacity: 0.52,
          blending: THREE.AdditiveBlending
        });

        cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMaterial);
        cloudsMesh.rotation.y = targetRotationY;
        cloudsMesh.rotation.x = targetRotationX;
        scene.add(cloudsMesh);

        // -------------------------------------------------------------------
        // Render Genuine 3D Boundaries Draped on Sphere Surface
        // -------------------------------------------------------------------
        init3DGeospatialBoundaries();

        // Initialize 3D CCTV Camera Layer & Viewshed Frustums (God's Eye View)
        initThreeCctvLayers();
      }

      // ---------------------------------------------------------------------
      // 3D GeoJSON Boundary Renderers
      // ---------------------------------------------------------------------
      function init3DGeospatialBoundaries() {
        if (!globeMesh) return;
        const data = window.TERRASCOPE_DATA || {};

        // 1. India Subcontinent Outline
        if (data.india_boundary && data.india_boundary.length) {
          const indiaPoints = [];
          data.india_boundary.forEach(poly => {
            for (let i = 0; i < poly.length - 1; i++) {
              const p1 = latLonToGlobeVector3(poly[i][1], poly[i][0], 0.8525);
              const p2 = latLonToGlobeVector3(poly[i+1][1], poly[i+1][0], 0.8525);
              indiaPoints.push(p1, p2);
            }
          });
          const indiaGeom = new THREE.BufferGeometry().setFromPoints(indiaPoints);
          const indiaMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.75,
            linewidth: 1
          });
          indiaBoundaryMesh = new THREE.LineSegments(indiaGeom, indiaMat);
          globeMesh.add(indiaBoundaryMesh);
        }

        // 2. Telangana 33 Administrative Districts Boundary (Purple Glow + Cyan Grid)
        if (data.districts_geojson && data.districts_geojson.features) {
          telanganaBoundaryGroup = new THREE.Group();
          const distPoints = [];
          data.districts_geojson.features.forEach(feat => {
            const geom = feat.geometry;
            if (!geom) return;
            const parseRings = (rings) => {
              rings.forEach(ring => {
                for (let i = 0; i < ring.length - 1; i++) {
                  const p1 = latLonToGlobeVector3(ring[i][1], ring[i][0], 0.8532);
                  const p2 = latLonToGlobeVector3(ring[i+1][1], ring[i+1][0], 0.8532);
                  distPoints.push(p1, p2);
                }
              });
            };
            if (geom.type === 'Polygon') parseRings(geom.coordinates);
            else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(parseRings);
          });

          const distGeom = new THREE.BufferGeometry().setFromPoints(distPoints);
          const distMat = new THREE.LineBasicMaterial({
            color: 0xc084fc,
            transparent: true,
            opacity: 0.95,
            linewidth: 2
          });
          const distLines = new THREE.LineSegments(distGeom, distMat);
          telanganaBoundaryGroup.add(distLines);
          globeMesh.add(telanganaBoundaryGroup);
        }

        // 3. Sentinel-1 SAR Flood Inundation Polygons (Telangana Exclusive)
        if (data.flood_geojson && data.flood_geojson.features) {
          const floodPoints = [];
          data.flood_geojson.features.forEach(feat => {
            const geom = feat.geometry;
            if (!geom) return;
            const parseRings = (rings) => {
              rings.forEach(ring => {
                for (let i = 0; i < ring.length - 1; i++) {
                  const p1 = latLonToGlobeVector3(ring[i][1], ring[i][0], 0.854);
                  const p2 = latLonToGlobeVector3(ring[i+1][1], ring[i+1][0], 0.854);
                  floodPoints.push(p1, p2);
                }
              });
            };
            if (geom.type === 'Polygon') parseRings(geom.coordinates);
            else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(parseRings);
          });
          const floodGeom = new THREE.BufferGeometry().setFromPoints(floodPoints);
          const floodMat = new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.90,
            linewidth: 2
          });
          flood3DMesh = new THREE.LineSegments(floodGeom, floodMat);
          globeMesh.add(flood3DMesh);
        }
      }

      // ---------------------------------------------------------------------
      // Multi-Touch & Mouse Orbit / Tilt Controls (Google Earth Paradigm)
      // ---------------------------------------------------------------------
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
          isRightDragging = true;
        } else if (e.button === 0) {
          isDragging = true;
        }
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        mouseDragDistance = 0;
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
        isRightDragging = false;
      });

      // Click to select CCTV Camera Pins
      canvas.addEventListener('click', (e) => {
        if (mouseDragDistance > 6 || !globeMesh || !cctvMarkerPins.length) return;
        const rect = canvas.getBoundingClientRect();
        mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVector, camera);
        const activePins = cctvMarkerPins.filter(p => p.visible);
        const intersects = raycaster.intersectObjects(activePins);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData && hit.userData.cameraId) {
            selectCctvCamera(hit.userData.cameraId);
          }
        }
      });

      window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (globeMesh) {
          raycaster.setFromCamera(mouseVector, camera);
          const intersects = raycaster.intersectObject(globeMesh);
          if (intersects.length > 0) {
            const point = intersects[0].point;
            const radius = 0.85;
            const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, point.y / radius))) * 180 / Math.PI);
            let lon = ((Math.atan2(point.x, point.z) - globeMesh.rotation.y) * 180 / Math.PI);
            lon = ((lon + 180) % 360) - 180;
            document.getElementById('cursorCoords').innerText = `Lat: ${lat.toFixed(3)}° N, Lon: ${lon.toFixed(3)}° E`;
          }
        }

        if (!isDragging && !isRightDragging) return;
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        mouseDragDistance += Math.abs(deltaX) + Math.abs(deltaY);
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        if (isRightDragging) {
          // Camera Tilt / Pitch Control (Horizon Curvature Angle)
          targetCameraPitch += deltaY * 0.0055;
          targetCameraPitch = Math.max(0.0, Math.min(1.15, targetCameraPitch));
        } else if (isDragging) {
          // Globe Longitude / Latitude Rotation
          targetRotationY += deltaX * 0.005;
          targetRotationX += deltaY * 0.005;
          targetRotationX = Math.max(-1.1, Math.min(1.1, targetRotationX));
        }
      });

      // Smooth Wheel Zoom
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        targetCameraDistance += e.deltaY * 0.0015;
        targetCameraDistance = Math.max(1.32, Math.min(3.8, targetCameraDistance));
      });

      window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });

      // ---------------------------------------------------------------------
      // Update Surface-Anchored HUD Markers with Real 3D Horizon Occlusion
      // ---------------------------------------------------------------------
      function updateScreenMarkers() {
        if (!globeMesh) return;
        const markers = [
          { el: document.getElementById('labelIndia'), lat: 21.0, lon: 78.5, scope: ['global', 'india'] },
          { el: document.getElementById('labelTelangana'), lat: 17.85, lon: 79.55, scope: ['global', 'india', 'telangana'] },
          { el: document.getElementById('markerFire'), lat: 17.978, lon: 79.594, scope: ['global', 'india', 'telangana'] },
          { el: document.getElementById('markerRain'), lat: 17.385, lon: 78.486, scope: ['global', 'india', 'telangana'] },
          { el: document.getElementById('markerPlane'), lat: 15.200, lon: 82.500, scope: ['global', 'india'] },
          { el: document.getElementById('markerShip'), lat: 8.500, lon: 86.000, scope: ['global', 'india'] },
          { el: document.getElementById('markerCyclone'), lat: 11.500, lon: 88.200, scope: ['global', 'india'] }
        ];

        const camDir = camera.position.clone().normalize();
        const canvasRect = canvas.getBoundingClientRect();
        const hw = canvasRect.width / 2;
        const hh = canvasRect.height / 2;

        markers.forEach(m => {
          if (!m.el) return;
          if (m.scope && !m.scope.includes(currentScope)) {
            m.el.style.display = 'none';
            return;
          }

          const localPos = latLonToGlobeVector3(m.lat, m.lon, 0.865);
          // Apply globeMesh rotation to obtain world space position
          const worldPos = localPos.clone().applyEuler(globeMesh.rotation);
          
          // Test horizon occlusion (facing camera)
          const normal = worldPos.clone().normalize();
          const dot = normal.dot(camDir);

          if (dot < 0.12) {
            // Occluded on back of spherical Earth
            m.el.style.display = 'none';
          } else {
            m.el.style.display = (m.el.id === 'labelTelangana') ? 'flex' : 'block';
            const screenPos = worldPos.clone().project(camera);
            const x = (screenPos.x * hw) + hw;
            const y = -(screenPos.y * hh) + hh;
            m.el.style.left = `${x}px`;
            m.el.style.top = `${y}px`;
          }
        });
      }

      // Animation Loop with Play/Pause support
      function animate() {
        requestAnimationFrame(animate);
        if (globeMesh) {
          // Strictly stationary unless explicitly enabled by user
          if (isContinuousRotating && !isDragging && !isRightDragging) {
            targetRotationY += 0.00045;
          }
          globeMesh.rotation.y += (targetRotationY - globeMesh.rotation.y) * 0.08;
          globeMesh.rotation.x += (targetRotationX - globeMesh.rotation.x) * 0.08;
          if (cloudsMesh) {
            cloudsMesh.rotation.y = globeMesh.rotation.y;
            cloudsMesh.rotation.x = globeMesh.rotation.x;
          }
        }

        // Smooth Camera Pitch & Distance Interpolation
        cameraDistance += (targetCameraDistance - cameraDistance) * 0.08;
        cameraPitch += (targetCameraPitch - cameraPitch) * 0.08;
        const camY = cameraDistance * Math.sin(cameraPitch);
        const camZ = cameraDistance * Math.cos(cameraPitch);
        camera.position.set(0, camY, camZ);
        camera.lookAt(0, 0, 0);

        // Update Surface-Anchored Screen Markers
        updateScreenMarkers();

        renderer.render(scene, camera);
      }
      animate();
    }

    function toggleGlobeRotation() {
      isContinuousRotating = !isContinuousRotating;
      const btn = document.getElementById('btnRotation');
      btn.innerText = isContinuousRotating ? '⏸️' : '▶️';
      btn.title = isContinuousRotating ? 'Pause Continuous Rotation' : 'Enable Auto-Rotation (Optional)';
    }

    function toggleCameraTilt() {
      // Toggle between 0 deg overhead and 43 deg oblique horizon tilt
      targetCameraPitch = (targetCameraPitch > 0.3) ? 0.0 : 0.72;
      const btn = document.getElementById('btnTilt');
      if (btn) btn.classList.toggle('active', targetCameraPitch > 0.3);
    }

    // Dynamic Cloud Layer Canvas
    function createDynamicCloudCanvas() {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 1024, 512);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      for (let i = 0; i < 45; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        ctx.beginPath();
        ctx.ellipse(x, y, 60 + Math.random() * 100, 15 + Math.random() * 25, Math.random() * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Swirling Tropical Cyclone Spiral
      const cx = 820, cy = 190;
      for (let r = 8; r < 65; r += 7) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 - r / 80})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, r * 0.12, r * 0.12 + Math.PI * 1.55);
        ctx.stroke();
      }
      return c;
    }

    '''

    html = re.sub(js_section_regex, new_threejs_engine + r'\2', html, flags=re.DOTALL)
    print("Replaced Three.js Engine and controls.")

    # 4. Update setScope function to control camera distance and pitch smoothly
    old_set_scope = """      if (scope === 'global') {
        document.getElementById('pillGlobal').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'block';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.38;
        targetRotationX = 0.32;
        camera.position.z = 2.45;
        if (leafletMapInstance) leafletMapInstance.flyTo([20.0, 78.5], 4);
        if (tickerStrong) tickerStrong.innerText = '🌐 Global Monitoring';
        if (tickerDesc) tickerDesc.innerText = '195 Countries • Real-time Data • AI Intelligence';
        if (statAct) statAct.innerText = '27';
        if (statRsk) statRsk.innerText = '8';
        if (statFir) statFir.innerText = '5';
        if (statFld) statFld.innerText = '7';
        if (statQke) statQke.innerText = '2';
        if (statExp) statExp.innerText = '1.8M';
      } else if (scope === 'india') {
        document.getElementById('pillIndia').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'block';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.38;
        targetRotationX = 0.34;
        camera.position.z = 1.85;
        if (leafletMapInstance) leafletMapInstance.flyTo([21.0, 79.0], 5);
        if (tickerStrong) tickerStrong.innerText = '🇮🇳 Subcontinental Monitoring';
        if (tickerDesc) tickerDesc.innerText = '28 States & 8 UTs • IMD & Open Data Intelligence';
        if (statAct) statAct.innerText = '12';
        if (statRsk) statRsk.innerText = '4';
        if (statFir) statFir.innerText = '2';
        if (statFld) statFld.innerText = '3';
        if (statQke) statQke.innerText = '1';
        if (statExp) statExp.innerText = '420K';
      } else if (scope === 'telangana') {
        document.getElementById('pillTelangana').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'none';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.39;
        targetRotationX = 0.36;
        camera.position.z = 1.45;
        if (leafletMapInstance) leafletMapInstance.flyTo([17.85, 79.55], 8);"""

    new_set_scope = """      if (scope === 'global') {
        document.getElementById('pillGlobal').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'block';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.38;
        targetRotationX = 0.32;
        targetCameraDistance = 2.45;
        targetCameraPitch = 0.0;
        if (flood3DMesh) flood3DMesh.visible = false;
        if (leafletMapInstance) leafletMapInstance.flyTo([20.0, 78.5], 4);
        if (tickerStrong) tickerStrong.innerText = '🌐 Global Monitoring';
        if (tickerDesc) tickerDesc.innerText = '195 Countries • Real-time Data • AI Intelligence';
        if (statAct) statAct.innerText = '27';
        if (statRsk) statRsk.innerText = '8';
        if (statFir) statFir.innerText = '5';
        if (statFld) statFld.innerText = '7';
        if (statQke) statQke.innerText = '2';
        if (statExp) statExp.innerText = '1.8M';
      } else if (scope === 'india') {
        document.getElementById('pillIndia').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'block';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.38;
        targetRotationX = 0.34;
        targetCameraDistance = 1.85;
        targetCameraPitch = 0.25;
        if (flood3DMesh) flood3DMesh.visible = false;
        if (leafletMapInstance) leafletMapInstance.flyTo([21.0, 79.0], 5);
        if (tickerStrong) tickerStrong.innerText = '🇮🇳 Subcontinental Monitoring';
        if (tickerDesc) tickerDesc.innerText = '28 States & 8 UTs • IMD & Open Data Intelligence';
        if (statAct) statAct.innerText = '12';
        if (statRsk) statRsk.innerText = '4';
        if (statFir) statFir.innerText = '2';
        if (statFld) statFld.innerText = '3';
        if (statQke) statQke.innerText = '1';
        if (statExp) statExp.innerText = '420K';
      } else if (scope === 'telangana') {
        document.getElementById('pillTelangana').classList.add('active');
        if (lblIndia) lblIndia.style.display = 'none';
        if (lblTelangana) lblTelangana.style.display = 'flex';
        targetRotationY = -1.39;
        targetRotationX = 0.36;
        targetCameraDistance = 1.42;
        targetCameraPitch = 0.58;
        if (flood3DMesh) flood3DMesh.visible = true;
        if (leafletMapInstance) leafletMapInstance.flyTo([17.85, 79.55], 8);"""

    if old_set_scope in html:
        html = html.replace(old_set_scope, new_set_scope)
        print("Updated setScope with camera pitch & flood visibility.")
    else:
        print("Exact setScope match not found, checking regex...")
        # fallback regex for setScope
        html = re.sub(
            r'if \(scope === \'global\'\)\s*\{.*?if \(leafletMapInstance\) leafletMapInstance\.flyTo\(\[17\.85, 79\.55\], 8\);',
            new_set_scope,
            html,
            flags=re.DOTALL
        )

    # 5. Update resetGlobeView and zoomGlobe
    old_reset_zoom = """    function resetGlobeView() {
      targetRotationY = -1.38;
      targetRotationX = 0.32;
      camera.position.z = 2.45;
      if (leafletMapInstance && is2DActive) {
        leafletMapInstance.flyTo([17.85, 79.55], 7);
      }
    }

    function zoomGlobe(delta) {
      camera.position.z -= delta * 0.25;
      camera.position.z = Math.max(1.3, Math.min(4.0, camera.position.z));
      if (leafletMapInstance && is2DActive) {
        if (delta > 0) leafletMapInstance.zoomIn();
        else leafletMapInstance.zoomOut();
      }
    }"""

    new_reset_zoom = """    function resetGlobeView() {
      targetRotationY = -1.38;
      targetRotationX = 0.32;
      targetCameraDistance = 2.45;
      targetCameraPitch = 0.0;
      if (leafletMapInstance && is2DActive) {
        leafletMapInstance.flyTo([17.85, 79.55], 7);
      }
    }

    function zoomGlobe(delta) {
      targetCameraDistance -= delta * 0.25;
      targetCameraDistance = Math.max(1.32, Math.min(3.8, targetCameraDistance));
      if (leafletMapInstance && is2DActive) {
        if (delta > 0) leafletMapInstance.zoomIn();
        else leafletMapInstance.zoomOut();
      }
    }"""

    if old_reset_zoom in html:
        html = html.replace(old_reset_zoom, new_reset_zoom)
        print("Updated resetGlobeView and zoomGlobe.")

    with open('web/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("All upgrades written to web/index.html successfully!")

if __name__ == '__main__':
    apply_full_upgrade()
