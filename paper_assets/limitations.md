# Scientific Limitations and Scope Boundaries (Paper Section VI)

In accordance with rigorous academic reproducibility standards, the following scientific boundaries and constraints apply to the TerraScope framework:

1. **Single-Event Scope:** The experimental validation focuses specifically on the September 1–4, 2024 severe monsoon rainfall and flood event in Telangana, trained against ISRO-NRSC Ground Truth Map No. `2024/FL/TS/03/01092024`. Generalization across distinct seasons, semi-arid flash droughts, and alternative physiographic regions requires prospective multi-temporal validation.

2. **Spatial Resampling and Coarse Atmospheric Forcings:** While Synthetic Aperture Radar (Sentinel-1) and optical imagery (Sentinel-2) provide fine 10–30 m resolution, CHIRPS precipitation (0.05° $\approx$ 5.5 km) and ERA5-Land atmospheric variables (0.10° $\approx$ 9 km) are inherently coarse. Bilinear and nearest-neighbor upsampling to a common 30 m grid introduces spatial smoothing that cannot resolve hyper-local microclimatic turbulence or urban micro-drainage variations.

3. **Nature of the Composite Risk Index:** The Hazard–Exposure–Vulnerability ($H \times E \times V$) metric generates a **relative risk ranking** among the 33 administrative districts of Telangana, rather than an absolute calibrated actuarial probability of infrastructure failure or casualty rate. It is intended for comparative resource prioritization by disaster management authorities.

4. **Downwind Fire Advection Geometry:** The directional downwind wedge ($\pm 30^\circ$, 5 km buffer) models atmospheric smoke, particulate transport, and short-range ember exposure based on ERA5-Land ambient wind vectors. It **does not** constitute a dynamic, two-phase physical fire spread or combustion physics simulation (such as FARSITE or Rothermel models), as fuel moisture, local wind channeling, and micro-vegetation structure were not parameterized as dynamic combustion states.
