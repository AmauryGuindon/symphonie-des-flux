"""
DataCut — Script de prédiction
================================
Charge le modèle entraîné (model.pkl) et prédit les labels de style
pour une image donnée, en extrayant les mêmes features que le pipeline.

Usage:
    python predict.py <chemin_image>           # prédire depuis un fichier image
    python predict.py --json <features.json>   # prédire depuis un JSON de features

Exemple:
    python predict.py photo.jpg
    python predict.py ../uploads/gallery/coupe.png

Prérequis:
    pip install -r requirements.txt
"""

import sys
import os
import json
import pickle
import argparse
import numpy as np

# Force UTF-8 sur Windows (terminal CP1252 par defaut)
if sys.stdout.encoding and sys.stdout.encoding.upper() != 'UTF-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


# ── Extraction de features depuis une image ────────────────────────────────────

def extract_features_from_image(path: str) -> list[float]:
    """
    Extrait le vecteur 7D depuis un fichier image.
    Reproduit la logique de sharp côté NestJS :
        [width, height, sizeKb, ratio, r, g, b]
    """
    try:
        from PIL import Image
    except ImportError:
        print("Pillow est requis pour lire une image directement.")
        print("Installez-le : pip install Pillow")
        sys.exit(1)

    img      = Image.open(path).convert('RGB')
    w, h     = img.size
    size_kb  = os.path.getsize(path) / 1024
    ratio    = w / h if h > 0 else 1.0

    # Couleur dominante : moyenne des pixels (équivalent resize→1×1 dans sharp)
    thumb    = img.resize((50, 50), Image.LANCZOS)
    pixels   = np.array(thumb).reshape(-1, 3)
    r, g, b  = pixels.mean(axis=0).astype(int)

    return [float(w), float(h), float(size_kb), float(ratio),
            float(r), float(g), float(b)]


def extract_features_from_json(path: str) -> list[float]:
    """
    Extrait le vecteur 7D depuis un JSON de features exporté par DataCut.
    Format attendu :
        { "width": 1080, "height": 1350, "sizeKb": 312.4,
          "dominantColor": "#8E6442" }
    """
    with open(path, 'r', encoding='utf-8') as f:
        feat = json.load(f)

    w     = feat.get('width', 0)
    h     = feat.get('height', 0)
    size  = feat.get('sizeKb', 0)
    ratio = w / h if h > 0 else 1.0

    color = feat.get('dominantColor', '#808080').lstrip('#')
    try:
        r = int(color[0:2], 16)
        g = int(color[2:4], 16)
        b = int(color[4:6], 16)
    except Exception:
        r, g, b = 128, 128, 128

    return [float(w), float(h), float(size), float(ratio),
            float(r), float(g), float(b)]


# ── Chargement du modèle ──────────────────────────────────────────────────────

def load_model(model_path: str = None) -> dict:
    """Charge model.pkl depuis le même dossier que ce script si non spécifié."""
    if model_path is None:
        model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')

    if not os.path.exists(model_path):
        print(f"Erreur : modèle introuvable ->{model_path}")
        print("Entraînez d'abord le modèle : python train.py <dataset.json>")
        sys.exit(1)

    with open(model_path, 'rb') as f:
        return pickle.load(f)


# ── Prédiction ────────────────────────────────────────────────────────────────

def predict(features: list[float], model: dict) -> list[str]:
    """Retourne la liste des labels prédits pour un vecteur de features."""
    clf = model['clf']
    mlb = model['mlb']
    X   = np.array([features])
    y   = clf.predict(X)
    return list(mlb.inverse_transform(y)[0])


def predict_proba(features: list[float], model: dict) -> list[tuple[str, float]]:
    """
    Retourne les labels avec leur probabilité (si le classifieur le supporte).
    Utile pour afficher un score de confiance par label.
    """
    clf = model['clf']
    mlb = model['mlb']
    X   = np.array([features])

    try:
        # OvR renvoie un tableau (n_samples, n_classes)
        proba_matrix = clf.predict_proba(X)
        scores = list(proba_matrix[0])
        return sorted(
            zip(mlb.classes_, scores),
            key=lambda x: x[1],
            reverse=True
        )
    except AttributeError:
        # Classifieur sans predict_proba — on retourne les labels binaires
        labels = predict(features, model)
        return [(l, 1.0) for l in labels]


# ── Affichage ─────────────────────────────────────────────────────────────────

def print_result(features: list[float], labels: list[str],
                 scores: list[tuple[str, float]]) -> None:

    feature_names = ['width', 'height', 'sizeKb', 'ratio', 'r', 'g', 'b']
    print("\n=== DataCut — Prédiction ===")
    print("\nFeatures extraites :")
    for name, val in zip(feature_names, features):
        print(f"  {name:<10} {val:.2f}")

    print("\nLabels prédits :")
    if not labels:
        print("  (aucun label predit - dataset trop petit ou image atypique)")
    else:
        for label in labels:
            print(f"  [x] {label}")

    print("\nScores de confiance (tous les labels) :")
    for label, score in scores:
        bar    = '#' * int(score * 20)
        marker = ' <- predit' if label in labels else ''
        print(f"  {label:<12} {bar:<20} {score:.0%}{marker}")

    print()


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description='DataCut — prédit les labels de style pour une image.'
    )
    parser.add_argument(
        'input',
        help='Chemin vers une image (jpg, png, webp) ou un fichier JSON de features'
    )
    parser.add_argument(
        '--json', action='store_true',
        help='Interpréter le fichier d\'entrée comme un JSON de features DataCut'
    )
    parser.add_argument(
        '--model', default=None,
        help='Chemin vers model.pkl (défaut : ./model.pkl)'
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Erreur : fichier introuvable ->{args.input}")
        sys.exit(1)

    # Extraction des features
    if args.json:
        features = extract_features_from_json(args.input)
        print(f"Source : JSON de features ->{args.input}")
    else:
        features = extract_features_from_image(args.input)
        print(f"Source : image ->{args.input}")

    # Chargement du modèle et prédiction
    model  = load_model(args.model)
    labels = predict(features, model)
    scores = predict_proba(features, model)

    print_result(features, labels, scores)


if __name__ == '__main__':
    main()
