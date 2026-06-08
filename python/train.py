"""
DataCut — Script d'entraînement
================================
Usage:
    python train.py <chemin_vers_dataset.json>

Lit un fichier JSON exporté depuis la plateforme DataCut et entraîne
un classificateur multi-label de styles de coupe sur les features extraites.

Prérequis:
    pip install -r requirements.txt
"""

import sys
import json
import os
import pickle
import numpy as np
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score


# ── Chargement ────────────────────────────────────────────────────────────────

def load_dataset(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ── Feature engineering ───────────────────────────────────────────────────────

def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convertit #RRGGBB en (r, g, b). Retourne (128, 128, 128) si invalide."""
    try:
        h = hex_color.lstrip('#')
        if len(h) != 6:
            return (128, 128, 128)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except Exception:
        return (128, 128, 128)


def build_features(images: list) -> np.ndarray:
    """
    Construit un vecteur de features numériques depuis les métadonnées extraites.

    Features (7 dimensions):
        [0] width     — largeur en pixels
        [1] height    — hauteur en pixels
        [2] sizeKb    — taille du fichier en Ko
        [3] ratio     — ratio largeur/hauteur
        [4] r         — composante rouge de la couleur dominante
        [5] g         — composante verte de la couleur dominante
        [6] b         — composante bleue de la couleur dominante
    """
    rows = []
    for img in images:
        feat = img.get('features') or {}
        w     = feat.get('width', 0)
        h     = feat.get('height', 0)
        size  = feat.get('sizeKb', 0)
        ratio = w / h if h > 0 else 1.0
        r, g, b = hex_to_rgb(feat.get('dominantColor', '#808080'))
        rows.append([w, h, size, ratio, r, g, b])
    return np.array(rows, dtype=float)


# ── Entraînement ──────────────────────────────────────────────────────────────

def train(images: list) -> tuple:
    """
    Entraîne un classificateur RandomForest multi-label.
    Retourne (clf, mlb, X_test, y_test, y_pred).
    """
    X   = build_features(images)
    mlb = MultiLabelBinarizer()
    y   = mlb.fit_transform([img.get('labels', []) for img in images])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    clf = OneVsRestClassifier(
        RandomForestClassifier(n_estimators=100, random_state=42)
    )
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    return clf, mlb, X_test, y_test, y_pred


# ── Rapport ────────────────────────────────────────────────────────────────────

def print_report(mlb, y_test, y_pred) -> None:
    print("\n=== Résultats ===")
    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy exacte (toutes les étiquettes correctes) : {acc:.2%}")
    print("\nRapport par label :")
    print(classification_report(
        y_test, y_pred,
        target_names=mlb.classes_,
        zero_division=0
    ))


# ── Sauvegarde ─────────────────────────────────────────────────────────────────

def save_model(clf, mlb, output_path: str = 'model.pkl') -> None:
    with open(output_path, 'wb') as f:
        pickle.dump({'clf': clf, 'mlb': mlb}, f)
    print(f"Modèle sauvegardé : {output_path}")
    print("Pour réutiliser :")
    print("  import pickle")
    print("  model = pickle.load(open('model.pkl', 'rb'))")
    print("  pred = model['clf'].predict(features_array)")
    print("  labels = model['mlb'].inverse_transform(pred)")


# ── Point d'entrée ─────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"Erreur : fichier introuvable → {path}")
        sys.exit(1)

    print("\n=== DataCut — Entraînement du modèle ===")
    print(f"Fichier : {path}\n")

    data = load_dataset(path)
    print(f"Version    : {data.get('version', '?')}")
    print(f"Créé le    : {data.get('createdAt', '?')}")
    print(f"Images     : {data.get('imageCount', 0)}")
    if data.get('description'):
        print(f"Description: {data['description']}")
    print(f"Labels     : {data.get('labelsIncluded', [])}\n")

    images = [img for img in data.get('images', []) if img.get('labels')]

    if len(images) < 5:
        print(
            f"Pas assez d'images labelisées ({len(images)} trouvée(s), minimum 5).\n"
            "Labelisez vos images dans le pipeline DataCut puis re-exportez."
        )
        sys.exit(1)

    print(f"Images avec labels : {len(images)}")
    clf, mlb, X_test, y_test, y_pred = train(images)
    print(f"Labels détectés    : {list(mlb.classes_)}")

    print_report(mlb, y_test, y_pred)
    save_model(clf, mlb)
    print("\nEntraînement terminé.")


if __name__ == '__main__':
    main()
