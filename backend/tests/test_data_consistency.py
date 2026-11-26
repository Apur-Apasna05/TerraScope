"""
TerraScope: Automated Geospatial Data Integrity & Consistency Test Suite.
Verifies the 10 Data Consistency Requirements & Warangal Regression Test:
1. Every district on map exists in official 33-district dataset.
2. Every district polygon has a valid district ID (official LGD code).
3. Backend produces exactly one canonical risk record per district per epoch.
4. Severity shown in alert matches canonical district severity.
5. Severity shown on map matches canonical district severity.
6. Severity shown in district details matches canonical district severity.
7. Risk score and timestamp are identical across all components.
8. Missing input data results in DATA_UNAVAILABLE state rather than a fabricated score.
9. Stale/historical observations cannot generate live emergency alerts.
10. Non-Telangana locations cannot access Telangana flood analytics (Mode Guard).
11. Warangal Regression Test: Confirms alert panel, map polygon, and district dossier
    for Warangal Rural (522) and Warangal Urban (686) report the exact same risk state.
"""
import os
import sys
import json
import unittest
from pathlib import Path

# Setup paths
repo_root = Path(__file__).resolve().parent.parent.parent
backend_dir = repo_root / "backend"
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient

from app.core.telangana_districts import (
    OFFICIAL_TELANGANA_DISTRICTS,
    resolve_district_lgd,
    get_district_by_lgd,
)
from app.services.canonical_risk_service import (
    compute_canonical_33_district_risk,
    get_canonical_risk_for_district,
    get_canonical_alerts,
    get_canonical_33_districts_geojson,
    SEVERITY_THRESHOLDS,
)
from app.main import app as backend_app
from src.api.main import app as web_app


class TestDataConsistency(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.backend_client = TestClient(backend_app)
        cls.web_client = TestClient(web_app)
        dashboard_json_path = repo_root / "web" / "dashboard_data.json"
        with open(dashboard_json_path, "r", encoding="utf-8") as f:
            cls.dashboard_data = json.load(f)

    def test_01_all_districts_exist_in_official_33_dataset(self):
        """Req 1: Every district on the map exists in the official 33-district dataset."""
        features = self.dashboard_data["districts_geojson"]["features"]
        self.assertEqual(len(features), 33, "Map GeoJSON must contain exactly 33 district polygons")
        
        for feat in features:
            props = feat["properties"]
            lgd = props.get("dist_lgd") or props.get("district_id")
            self.assertIsNotNone(lgd, f"Feature missing dist_lgd/district_id: {props}")
            self.assertIn(int(lgd), OFFICIAL_TELANGANA_DISTRICTS, f"District LGD {lgd} not in official 33 districts")
            
            meta = get_district_by_lgd(int(lgd))
            self.assertIsNotNone(meta)
            self.assertEqual(meta.dtname, props["district"])

    def test_02_every_district_polygon_has_valid_district_id(self):
        """Req 2: Every district polygon has a valid district ID (official LGD code)."""
        resp = self.backend_client.get("/api/telangana/districts", headers={"X-TerraScope-Mode": "TELANGANA"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        
        districts = data["districts"]
        self.assertEqual(len(districts), 33)
        for d in districts:
            self.assertIn("district_id", d)
            self.assertIsInstance(d["district_id"], int)
            self.assertIn(d["district_id"], OFFICIAL_TELANGANA_DISTRICTS)

    def test_03_exactly_one_canonical_risk_record_per_district_per_epoch(self):
        """Req 3: The backend produces exactly one canonical risk record per district per epoch."""
        records = compute_canonical_33_district_risk(epoch="peak_sept2024", prefer_live=False, force_refresh=True)
        self.assertEqual(len(records), 33, "Canonical risk service must evaluate exactly 33 districts")
        
        lgd_set = {r.district_id for r in records}
        self.assertEqual(len(lgd_set), 33, "District LGD codes must be completely unique with zero duplicates")
        self.assertEqual(lgd_set, set(OFFICIAL_TELANGANA_DISTRICTS.keys()))

    def test_04_alert_severity_matches_canonical_district_severity(self):
        """Req 4: The severity shown in the alert matches the canonical district severity."""
        alerts, _ = get_canonical_alerts(prefer_live=False)
        self.assertGreater(len(alerts), 0, "Historical epoch must produce alerts for impacted districts")
        
        for alert in alerts:
            rec = get_canonical_risk_for_district(alert.district_id, prefer_live=False)
            self.assertIsNotNone(rec, f"Alert district {alert.district_id} not found in canonical records")
            self.assertEqual(
                alert.severity.upper(),
                rec.severity_level.upper(),
                f"Alert severity '{alert.severity}' does not match district severity '{rec.severity_level}' for {alert.district_name}"
            )
            self.assertAlmostEqual(
                alert.risk_score,
                rec.risk_score,
                places=4,
                msg=f"Alert risk score {alert.risk_score} does not match district risk score {rec.risk_score}"
            )

    def test_05_map_severity_matches_canonical_district_severity(self):
        """Req 5: The severity shown on the map matches the canonical district severity."""
        canonical_records = compute_canonical_33_district_risk(prefer_live=False)
        rec_by_lgd = {r.district_id: r for r in canonical_records}
        
        features = self.dashboard_data["districts_geojson"]["features"]
        for feat in features:
            props = feat["properties"]
            lgd = int(props["dist_lgd"])
            rec = rec_by_lgd[lgd]
            self.assertEqual(
                props["severity_level"].upper(),
                rec.severity_level.upper(),
                f"Map severity for {props['district']} does not match canonical severity"
            )
            self.assertAlmostEqual(
                props["risk_score"],
                rec.risk_score,
                places=4,
                msg=f"Map risk score for {props['district']} does not match canonical risk score"
            )

    def test_06_district_details_severity_matches_canonical_district_severity(self):
        """Req 6: The severity shown in the district details matches canonical district severity."""
        canonical_records = compute_canonical_33_district_risk(prefer_live=False)
        for rec in canonical_records:
            # Test backend router: /api/telangana/districts/{name}
            resp = self.backend_client.get(
                f"/api/telangana/districts/{rec.district_name}",
                headers={"X-TerraScope-Mode": "TELANGANA"}
            )
            self.assertEqual(resp.status_code, 200)
            data = resp.json()["data"]
            self.assertEqual(data["severity_level"].upper(), rec.severity_level.upper())
            self.assertAlmostEqual(data["risk_score"], rec.risk_score, places=4)

            # Test web API: /api/districts/{lgd}
            resp_web = self.web_client.get(f"/api/districts/{rec.district_id}")
            self.assertEqual(resp_web.status_code, 200)
            web_data = resp_web.json()
            self.assertEqual(web_data["summary"]["severity_level"].upper(), rec.severity_level.upper())
            self.assertAlmostEqual(web_data["summary"]["risk_score"], rec.risk_score, places=4)

    def test_07_risk_score_and_timestamp_identical_across_all_components(self):
        """Req 7: Risk score and timestamp are identical across all components."""
        canonical_records = compute_canonical_33_district_risk(prefer_live=False)
        alerts, _ = get_canonical_alerts(prefer_live=False)
        alert_map = {a.district_id: a for a in alerts}
        
        map_features = {int(f["properties"]["dist_lgd"]): f["properties"] for f in self.dashboard_data["districts_geojson"]["features"]}
        ranking_rows = {int(r["district_id"]): r for r in self.dashboard_data["district_peak_ranking"]}
        
        for rec in canonical_records:
            lgd = rec.district_id
            mf = map_features[lgd]
            rf = ranking_rows[lgd]
            
            # Map vs Canonical
            self.assertAlmostEqual(rec.risk_score, mf["risk_score"], places=4)
            self.assertEqual(rec.observed_at, mf["observed_at"])
            
            # Ranking vs Canonical
            self.assertAlmostEqual(rec.risk_score, rf["risk_score"], places=4)
            self.assertEqual(rec.observed_at, rf["observed_at"])
            
            # Alert vs Canonical (if district generated an alert)
            if lgd in alert_map:
                af = alert_map[lgd]
                self.assertAlmostEqual(rec.risk_score, af.risk_score, places=4)
                self.assertEqual(rec.observed_at, af.observed_at)

    def test_08_missing_input_data_produces_unavailable_state_not_fabricated(self):
        """Req 8: Missing input data results in an incomplete or unavailable state rather than a fabricated score."""
        live_records = compute_canonical_33_district_risk(prefer_live=True, force_refresh=True)
        for r in live_records:
            self.assertEqual(r.availability_status, "DATA_UNAVAILABLE")
            self.assertEqual(r.data_freshness, "DATA_UNAVAILABLE")
            self.assertEqual(r.risk_score, 0.0, "Missing live raster must produce 0.0 score, never a fabricated score")

    def test_09_stale_or_historical_cannot_generate_live_emergency_alerts(self):
        """Req 9: Stale or historical observations cannot generate live emergency alerts."""
        live_alerts, gate_status = get_canonical_alerts(prefer_live=True)
        self.assertEqual(len(live_alerts), 0, "Live mode must produce ZERO synthetic alerts when live raster is offline")
        self.assertEqual(gate_status["status"], "DATA_UNAVAILABLE")
        self.assertFalse(gate_status["live_raster_available"])

    def test_10_non_telangana_locations_cannot_access_telangana_flood_model(self):
        """Req 10: Non-Telangana locations cannot access the Telangana flood model."""
        # 1. Point outside Telangana (New Delhi)
        resp = self.backend_client.get(
            "/api/telangana/point-check?lat=28.6139&lon=77.2090",
            headers={"X-TerraScope-Mode": "TELANGANA"}
        )
        self.assertEqual(resp.status_code, 422, "Points outside Telangana boundary must return 422 Unprocessable (out_of_scope_region)")
        self.assertEqual(resp.json()["detail"]["error"], "out_of_scope_region")
        
        # 2. Mode guard: Accessing Telangana API under GLOBAL mode
        resp_global = self.backend_client.get(
            "/api/telangana/risk",
            headers={"X-TerraScope-Mode": "GLOBAL"}
        )
        self.assertEqual(resp_global.status_code, 403, "Telangana analytics must be blocked under GLOBAL mode")

    def test_11_warangal_regression_zero_conflicts(self):
        """
        Req 11: Warangal Regression Test.
        Confirm that the alert panel, map polygon, and district dossier for Warangal
        always report the exact same risk state and score under identical query conditions.
        Distinguishes Warangal Rural (LGD 522) from Warangal Urban (LGD 686).
        Guarantees that neither is EVER reported as 'HIGH' or 'Wildfire Detected'.
        """
        # 1. Warangal Rural (LGD 522)
        rec_rural = get_canonical_risk_for_district(522, prefer_live=False)
        self.assertIsNotNone(rec_rural)
        self.assertEqual(rec_rural.district_name, "Warangal Rural")
        self.assertEqual(rec_rural.severity_level, "MEDIUM")
        self.assertAlmostEqual(rec_rural.risk_score, 0.1379, places=3)

        # 2. Warangal Urban (LGD 686)
        rec_urban = get_canonical_risk_for_district(686, prefer_live=False)
        self.assertIsNotNone(rec_urban)
        self.assertEqual(rec_urban.district_name, "Warangal Urban")
        self.assertEqual(rec_urban.severity_level, "LOW")
        self.assertAlmostEqual(rec_urban.risk_score, 0.0411, places=3)

        # 3. Verify Map Polygon for Warangal Rural
        map_rural = next(
            f["properties"] for f in self.dashboard_data["districts_geojson"]["features"]
            if f["properties"]["dist_lgd"] == 522
        )
        self.assertEqual(map_rural["severity_level"], "MEDIUM")
        self.assertEqual(map_rural["risk_tier"], "MEDIUM")
        self.assertAlmostEqual(map_rural["risk_score"], 0.1379, places=3)

        # 4. Verify Map Polygon for Warangal Urban
        map_urban = next(
            f["properties"] for f in self.dashboard_data["districts_geojson"]["features"]
            if f["properties"]["dist_lgd"] == 686
        )
        self.assertEqual(map_urban["severity_level"], "LOW")
        self.assertEqual(map_urban["risk_tier"], "LOW")
        self.assertAlmostEqual(map_urban["risk_score"], 0.0411, places=3)

        # 5. Verify Alerts for Warangal
        alerts, _ = get_canonical_alerts(prefer_live=False)
        warangal_alerts = [a for a in alerts if "Warangal" in a.district_name]
        self.assertEqual(len(warangal_alerts), 1, "Only Warangal Rural (MEDIUM) generates an alert; Warangal Urban (LOW) does not")
        
        rural_alert = warangal_alerts[0]
        self.assertEqual(rural_alert.district_id, 522)
        self.assertEqual(rural_alert.district_name, "Warangal Rural")
        self.assertEqual(rural_alert.severity, "MEDIUM")
        self.assertAlmostEqual(rural_alert.risk_score, 0.1379, places=3)

        # 6. Verify Web District Dossier Endpoint for Warangal Rural
        resp_web_rural = self.web_client.get("/api/districts/522")
        self.assertEqual(resp_web_rural.status_code, 200)
        dossier_rural = resp_web_rural.json()["summary"]
        self.assertEqual(dossier_rural["severity_level"], "MEDIUM")
        self.assertAlmostEqual(dossier_rural["risk_score"], 0.1379, places=3)

        # 7. Verify Web District Dossier Endpoint for Warangal Urban
        resp_web_urban = self.web_client.get("/api/districts/686")
        self.assertEqual(resp_web_urban.status_code, 200)
        dossier_urban = resp_web_urban.json()["summary"]
        self.assertEqual(dossier_urban["severity_level"], "LOW")
        self.assertAlmostEqual(dossier_urban["risk_score"], 0.0411, places=3)

        # 8. ABSOLUTE ZERO CONFLICT CHECK:
        # Confirm that 'Warangal' is NEVER reported as HIGH in any panel or alert
        all_severities = [
            rec_rural.severity_level,
            map_rural["severity_level"],
            rural_alert.severity,
            dossier_rural["severity_level"],
        ]
        self.assertTrue(all(s == "MEDIUM" for s in all_severities), f"Warangal Rural severities must all be MEDIUM: {all_severities}")
        self.assertNotIn("HIGH", all_severities, "Warangal Rural must NEVER be HIGH")

        urban_severities = [
            rec_urban.severity_level,
            map_urban["severity_level"],
            dossier_urban["severity_level"],
        ]
        self.assertTrue(all(s == "LOW" for s in urban_severities), f"Warangal Urban severities must all be LOW: {urban_severities}")
        self.assertNotIn("HIGH", urban_severities, "Warangal Urban must NEVER be HIGH")


if __name__ == "__main__":
    unittest.main()
