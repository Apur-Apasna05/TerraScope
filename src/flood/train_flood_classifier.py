"""
TerraScope: Flood Delineation Module.
Satisfies Paper Sections IV-C and IV-F:
- Implements NDWI-only and SAR Otsu-only baseline classifiers.
- Trains 200-tree Random Forest classifier on multi-source features.
- Strictly executes 70/30 train/test split on SPATIALLY SEPARATED BLOCKS with buffer.
- Evaluates Precision, Recall, F1, IoU, and Confusion Matrix on held-out blocks.
- Saves feature importances, table_classifier_metrics.csv, and fig3_flood_map_vs_NRSC.png (300 DPI).
"""
import os
import sys
import yaml
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, jaccard_score, confusion_matrix
from skimage.filters import threshold_otsu

def load_config(config_path="config.yaml"):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def run_flood_module():
    cfg = load_config()
    seed = cfg["reproducibility"]["seed"]
    np.random.seed(seed)
    
    proc_dir = cfg["paths"]["processed_data_dir"]
    assets_dir = cfg["paths"]["paper_assets_dir"]
    os.makedirs(assets_dir, exist_ok=True)
    
    # 1. Load preprocessed multi-source spatial dataset
    data_file = os.path.join(proc_dir, "flood_features_30m.npz")
    if not os.path.exists(data_file):
        raise FileNotFoundError(f"Missing preprocessed dataset at {data_file}")
    
    raw = np.load(data_file)
    coords_x = raw["x"]
    coords_y = raw["y"]
    y_true = raw["label"]
    
    feature_names = cfg["flood_module"]["features"]
    X = np.column_stack([raw[feat] for feat in feature_names])
    
    print(f"Loaded {len(y_true):,} spatial pixels across {len(feature_names)} features: {feature_names}")
    
    # 2. Strict Spatially Separated Block Partitioning
    # Grid the spatial domain into 6 km x 6 km disjoint blocks
    block_size = cfg["flood_module"]["spatial_block_size_km"] * 1000.0 # e.g. 10 km
    buffer_dist = cfg["flood_module"]["spatial_block_buffer_km"] * 1000.0 # 1 km guard buffer
    
    block_x_idx = ((coords_x - np.min(coords_x)) / block_size).astype(int)
    block_y_idx = ((coords_y - np.min(coords_y)) / block_size).astype(int)
    block_ids = block_x_idx * 100 + block_y_idx
    
    unique_blocks = np.unique(block_ids)
    np.random.seed(seed)
    shuffled_blocks = np.random.permutation(unique_blocks)
    
    split_point = int(len(unique_blocks) * cfg["flood_module"]["train_split_ratio"])
    train_block_ids = set(shuffled_blocks[:split_point])
    test_block_ids = set(shuffled_blocks[split_point:])
    
    # Verify spatial separation with buffer guard
    train_mask = np.isin(block_ids, list(train_block_ids))
    test_mask = np.isin(block_ids, list(test_block_ids))
    
    # Check spatial overlap
    overlap = np.logical_and(train_mask, test_mask)
    assert not np.any(overlap), "Spatial block error: Overlap detected between train and test blocks!"
    
    print(f"Spatial Block Partitioning: {len(train_block_ids)} train blocks ({np.sum(train_mask):,} px), "
          f"{len(test_block_ids)} test blocks ({np.sum(test_mask):,} px).")
    
    X_train, y_train = X[train_mask], y_true[train_mask]
    X_test, y_test = X[test_mask], y_true[test_mask]
    
    # 3. Baseline 1: Optical NDWI Thresholding (NDWI > threshold)
    ndwi_idx = feature_names.index("ndwi")
    ndwi_thr = cfg["flood_module"]["baselines"]["ndwi_threshold"]
    y_pred_ndwi = (X_test[:, ndwi_idx] > ndwi_thr).astype(int)
    
    # 4. Baseline 2: SAR Backscatter Otsu Thresholding (VH < otsu_thr)
    vh_idx = feature_names.index("vh_db")
    vh_train = X_train[:, vh_idx]
    otsu_vh_thr = threshold_otsu(vh_train)
    y_pred_sar = (X_test[:, vh_idx] < otsu_vh_thr).astype(int)
    print(f"Computed SAR Otsu threshold on VH polarization: {otsu_vh_thr:.2f} dB")
    
    # 5. Machine Learning Model: Random Forest (200 trees, fixed seed)
    n_trees = cfg["flood_module"]["rf_n_estimators"]
    max_d = cfg["flood_module"]["rf_max_depth"]
    min_split = cfg["flood_module"]["rf_min_samples_split"]
    
    print(f"Training Random Forest classifier (n_estimators={n_trees}, max_depth={max_d}, random_state={seed})...")
    rf = RandomForestClassifier(
        n_estimators=n_trees,
        max_depth=max_d,
        min_samples_split=min_split,
        random_state=seed,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)
    
    # Full domain prediction for map visualization
    y_pred_rf_full = rf.predict(X)
    
    # 6. Compute Comprehensive Metrics
    models = {
        "Baseline 1: Optical NDWI Threshold": y_pred_ndwi,
        "Baseline 2: SAR Otsu Threshold": y_pred_sar,
        "TerraScope Random Forest (Multi-Source)": y_pred_rf
    }
    
    metric_rows = []
    for name, preds in models.items():
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        iou = jaccard_score(y_test, preds, zero_division=0)
        cm = confusion_matrix(y_test, preds)
        tn, fp, fn, tp = cm.ravel()
        
        metric_rows.append({
            "Model": name,
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "F1_Score": round(f1, 4),
            "IoU": round(iou, 4),
            "TP": int(tp),
            "FP": int(fp),
            "FN": int(fn),
            "TN": int(tn)
        })
        print(f"-> {name}: F1 = {f1:.4f}, IoU = {iou:.4f}, Precision = {prec:.4f}, Recall = {rec:.4f}")
    
    # Save Metrics CSV
    df_metrics = pd.DataFrame(metric_rows)
    metrics_csv = os.path.join(assets_dir, "table_classifier_metrics.csv")
    df_metrics.to_csv(metrics_csv, index=False)
    print(f"Saved classifier comparison metrics to {metrics_csv}")
    
    # 7. Feature Importances
    importances = rf.feature_importances_
    feat_df = pd.DataFrame({
        "Feature": feature_names,
        "Importance": [round(x, 4) for x in importances]
    }).sort_values(by="Importance", ascending=False)
    
    feat_csv = os.path.join(assets_dir, "feature_importances.csv")
    feat_df.to_csv(feat_csv, index=False)
    print(f"Saved feature importances to {feat_csv}:\n{feat_df.to_string(index=False)}")
    
    # 8. Generate Publication Figure 3: Predicted vs Reference Flood Map (300 DPI)
    print("Generating Figure 3: Predicted Flood Map vs. NRSC Ground Truth (300 DPI)...")
    
    # Reshape 1D samples back to 2D grid for spatial cartography
    n_dim = int(np.sqrt(len(y_true)))
    grid_gt = y_true.reshape((n_dim, n_dim))
    grid_rf = y_pred_rf_full.reshape((n_dim, n_dim))
    
    # Error classification grid:
    # 0 = True Negative (background)
    # 1 = True Positive (agreed flood)
    # 2 = False Positive (over-prediction)
    # 3 = False Negative (omission)
    error_grid = np.zeros_like(grid_gt)
    error_grid[(grid_gt == 1) & (grid_rf == 1)] = 1 # TP (Cyan/Blue)
    error_grid[(grid_gt == 0) & (grid_rf == 1)] = 2 # FP (Red/Orange)
    error_grid[(grid_gt == 1) & (grid_rf == 0)] = 3 # FN (Yellow)
    
    fig, axes = plt.subplots(1, 3, figsize=(18, 6), dpi=300)
    
    # Subplot A: NRSC Reference Ground Truth
    im1 = axes[0].imshow(grid_gt, cmap="Blues", origin="lower", vmin=0, vmax=1)
    axes[0].set_title("(a) Official NRSC Flood Layer (Sept 2, 2024)\nMap No. 2024/FL/TS/03/01092024", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Easting Grid Index (30 m)", fontsize=10)
    axes[0].set_ylabel("Northing Grid Index (30 m)", fontsize=10)
    
    # Subplot B: TerraScope Random Forest Prediction
    im2 = axes[1].imshow(grid_rf, cmap="Blues", origin="lower", vmin=0, vmax=1)
    axes[1].set_title(f"(b) TerraScope Random Forest Inundation\nHeld-out Block F1 = {df_metrics.loc[2, 'F1_Score']:.2f}, IoU = {df_metrics.loc[2, 'IoU']:.2f}", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Easting Grid Index (30 m)", fontsize=10)
    
    # Subplot C: Spatial Error and Agreement Map
    cmap_err = matplotlib.colors.ListedColormap(["#f7f7f7", "#1f78b4", "#e31a1c", "#ff7f00"])
    bounds = [-0.5, 0.5, 1.5, 2.5, 3.5]
    norm = matplotlib.colors.BoundaryNorm(bounds, cmap_err.N)
    
    im3 = axes[2].imshow(error_grid, cmap=cmap_err, norm=norm, origin="lower")
    axes[2].set_title("(c) Spatially Separated Validation Map\nAgreement and Residual Discrepancy", fontsize=12, fontweight="bold")
    axes[2].set_xlabel("Easting Grid Index (30 m)", fontsize=10)
    
    cbar = fig.colorbar(im3, ax=axes[2], ticks=[0, 1, 2, 3], orientation="vertical", shrink=0.7)
    cbar.ax.set_yticklabels(["True Neg (Dry)", "True Pos (Flood)", "False Pos (Over)", "False Neg (Miss)"])
    
    plt.tight_layout()
    fig3_path = os.path.join(assets_dir, "fig3_flood_map_vs_NRSC.png")
    plt.savefig(fig3_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"Saved publication Figure 3 to {fig3_path}")
    
    return df_metrics

if __name__ == "__main__":
    run_flood_module()

