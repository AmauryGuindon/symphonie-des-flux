# DataCut — Rapport technique
## Symphonie des données en flux continu
### Master 1 Intelligence Artificielle — École 89
**Intervenant référent :** Najib AL AWAR
**Étudiant :** Amaury Guindon
**Année :** 2025–2026

---

# Table des matières

1. Introduction & contexte
2. Architecture de la plateforme
3. Schéma de base de données
4. Pipeline de données
5. Extraction de features
6. Versioning des datasets
7. Entraînement du modèle
8. Visualisation & supervision
9. Recommandation client par IA
10. Bonnes pratiques & gouvernance
11. Conclusion & perspectives

---

# 1. Introduction & contexte

## 1.1 Présentation du projet

DataCut est une plateforme web de gestion de données conçue dans le cadre du projet "Symphonie des données en flux continu". Elle s'inscrit dans le contexte fictif d'un barbershop haut de gamme souhaitant exploiter ses photos de réalisations pour entraîner un modèle de classification de styles de coupe.

L'objectif central est de mettre en œuvre un cycle de vie complet des données : de l'ingestion d'images brutes jusqu'à l'alimentation continue d'un modèle d'intelligence artificielle, en passant par la labélisation, le versioning et l'export structuré.

## 1.2 Problématique

Comment concevoir une infrastructure capable de collecter, structurer, labéliser et versionner des images, tout en garantissant la traçabilité complète du flux de données vers un modèle d'apprentissage automatique ?

## 1.3 Périmètre fonctionnel

La plateforme couvre deux volets distincts :

- **Backoffice (admin) :** gestion du pipeline de données, labélisation des images, création et export de datasets versionnés, supervision via des graphiques.
- **Interface client :** recommandation personnalisée de coupe de cheveux par analyse IA du visage (forme et teinte de peau).

---

# 2. Architecture de la plateforme

## 2.1 Vue d'ensemble

L'architecture repose sur une séparation claire entre trois couches :

```
┌─────────────────────────────────────────┐
│           Frontend (Angular 17)          │
│   Interface admin + Interface client     │
└──────────────────┬──────────────────────┘
                   │ HTTP REST (port 4200 → 3001)
┌──────────────────▼──────────────────────┐
│           Backend (NestJS)               │
│   API REST · Guards JWT · Multer        │
└─────────┬──────────────────┬────────────┘
          │                  │
┌─────────▼──────┐  ┌────────▼───────────┐
│  MongoDB        │  │  Disque local       │
│  (métadonnées) │  │  /uploads/gallery   │
│  Base: datacut  │  │  (fichiers images)  │
└─────────────────┘  └────────────────────┘
          │
┌─────────▼──────────────────────────────┐
│  Python (scikit-learn)                  │
│  train.py · model.pkl                   │
└────────────────────────────────────────┘
```

## 2.2 Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | Angular 17 (standalone, signals) | Interface utilisateur |
| Backend | NestJS + Mongoose | API REST, logique métier |
| Base de données | MongoDB | Stockage des métadonnées |
| Stockage fichiers | Système de fichiers (multer) | Stockage des images brutes |
| Feature extraction | sharp (Node.js) | Extraction automatique de caractéristiques |
| ML entraînement | Python / scikit-learn | Classification multi-label |
| ML client | MediaPipe (JavaScript) | Détection de forme de visage en temps réel |

## 2.3 Justification des choix techniques

**MongoDB** a été choisi pour sa flexibilité de schéma, idéale pour stocker des métadonnées hétérogènes (features image, labels variables, statut évolutif). Sa capacité d'agrégation native facilite les statistiques de distribution de labels.

**NestJS** structure le backend en modules indépendants (GalleryModule, DatasetModule, StatsModule), garantissant une séparation des responsabilités claire et une évolutivité naturelle.

**sharp** permet une extraction de features légère directement côté serveur, sans dépendance externe, au moment de l'upload.

**scikit-learn** offre une implémentation éprouvée du RandomForest multi-label, adaptée à un dataset de taille limitée.

**MediaPipe** s'exécute entièrement dans le navigateur (WebAssembly), sans envoi de données vers un serveur tiers, respectant ainsi la vie privée des utilisateurs.

---

# 3. Schéma de base de données

## 3.1 Principes de modélisation

La base de données `datacut` suit une approche **hybride** : les fichiers images sont stockés sur disque (`/uploads/gallery/`), tandis que toutes les métadonnées associées (statut, labels, features, versioning) sont stockées dans MongoDB. Cette séparation garantit performance et évolutivité.

## 3.2 Collection GalleryItem

Représente une image ingérée dans le pipeline.

```
GalleryItem {
  _id          : ObjectId          // Identifiant unique MongoDB
  filename     : String            // Nom du fichier sur disque
  url          : String            // Chemin d'accès relatif (/uploads/gallery/...)
  alt          : String?           // Texte alternatif
  span         : String?           // Mise en page galerie (tall, wide)
  category     : String?           // Catégorie (coupe, barbe, dégradé...)
  active       : Boolean           // Visible dans la galerie publique
  order        : Number            // Ordre d'affichage
  
  // Pipeline
  status       : Enum              // raw | validated | labeled | processed | exported
  labels       : [String]          // Labels assignés (fade, afro, tresse...)
  
  // Features extraites automatiquement (sharp)
  features     : {
    width        : Number          // Largeur en pixels
    height       : Number          // Hauteur en pixels
    sizeKb       : Number          // Taille du fichier en Ko
    format       : String          // jpeg, png, webp...
    dominantColor: String          // Couleur dominante (#RRGGBB)
  }
  
  // Dataset
  datasetVersion : String?         // Version dans laquelle l'image a été exportée
  
  createdAt    : Date
  updatedAt    : Date
}
```

## 3.3 Collection DatasetVersion

Représente un snapshot immuable d'un ensemble d'images labélisées.

```
DatasetVersion {
  _id            : ObjectId        // Identifiant unique
  version        : String          // Numéro de version (v1, v2, v3...)
  imageCount     : Number          // Nombre d'images dans ce snapshot
  imageIds       : [String]        // Liste des IDs des images incluses
  labelsIncluded : [String]        // Liste des labels présents dans le dataset
  description    : String?         // Description optionnelle
  
  createdAt      : Date
  updatedAt      : Date
}
```

## 3.4 Collection User

Gère l'authentification et les rôles (client / admin).

```
User {
  _id          : ObjectId
  firstName    : String
  lastName     : String
  email        : String            // Unique, lowercase
  password     : String?           // Hash bcrypt (absent si OAuth)
  googleId     : String?           // Connexion Google OAuth
  role         : Enum              // client | admin
  
  // Fidélité
  loyaltyPoints : Number
  visitCount    : Number
  loyaltyTier   : Enum             // bronze | silver | gold | platinum
  
  // Parrainage
  referralCode  : String?
  referredBy    : String?
  referralCount : Number
  
  createdAt    : Date
  updatedAt    : Date
}
```

## 3.5 Relations entre collections

- Un `GalleryItem` référence sa `DatasetVersion` via le champ `datasetVersion` (clé logique, non contrainte — MongoDB document store).
- Un `DatasetVersion` liste les `imageIds` des `GalleryItem` inclus dans le snapshot.
- La relation est intentionnellement légère : les snapshots sont immuables, les images ne sont jamais supprimées d'une version créée.

---

# 4. Pipeline de données

## 4.1 Vue d'ensemble du pipeline

Le pipeline structure le cycle de vie d'une image en 5 statuts successifs :

```
[Upload]
   │
   ▼
┌──────┐    ┌───────────┐    ┌─────────┐    ┌───────────┐    ┌──────────┐
│ RAW  │───▶│ VALIDATED │───▶│ LABELED │───▶│ PROCESSED │───▶│ EXPORTED │
└──────┘    └───────────┘    └─────────┘    └───────────┘    └──────────┘
  Upload      Vérification    Labélisation    Validation       Intégré dans
  + features  qualité image   manuelle        finale           un dataset
```

## 4.2 Description de chaque étape

### Phase 1 — RAW (Ingestion)
L'administrateur upload une image via l'interface galerie. Le backend (NestJS + Multer) :
- Sauvegarde le fichier sur disque dans `/uploads/gallery/`
- Extrait automatiquement les features via **sharp** (dimensions, taille, couleur dominante)
- Crée un document `GalleryItem` en base avec `status: 'raw'` et `labels: []`

### Phase 2 — VALIDATED
L'administrateur vérifie visuellement la qualité de l'image (cadrage, netteté, pertinence). Il la fait passer en `validated` depuis l'interface Pipeline.

### Phase 3 — LABELED
L'administrateur assigne un ou plusieurs labels à l'image parmi les 12 labels disponibles : `fade, dégradé, taper, burst-fade, afro, tresse, barbe, rasage, avant, après, enfant, adulte`.
Le statut passe automatiquement à `labeled` dès qu'au moins un label est assigné.

### Phase 4 — PROCESSED
Étape de validation finale avant export : l'image est considérée complète et prête à intégrer un dataset.

### Phase 5 — EXPORTED
L'image a été incluse dans un snapshot de dataset versionné. Son `datasetVersion` est renseigné. Elle reste exploitable dans les versions futures.

## 4.3 Règles de transition

- Les transitions sont **unidirectionnelles** : une image ne peut pas revenir à un statut antérieur.
- Seules les images au statut `labeled`, `processed` ou `exported` sont éligibles à la création d'un dataset.
- L'interface Pipeline affiche un funnel visuel des volumes par statut, permettant d'identifier les goulots d'étranglement.

---

# 5. Extraction de features

## 5.1 Principe

À chaque upload, le backend extrait automatiquement un vecteur de caractéristiques numériques depuis l'image, sans intervention humaine. Cette extraction utilise la bibliothèque **sharp** (Node.js).

## 5.2 Features extraites

| Index | Feature | Description | Exemple |
|---|---|---|---|
| 0 | width | Largeur en pixels | 1920 |
| 1 | height | Hauteur en pixels | 1080 |
| 2 | sizeKb | Taille du fichier en Ko | 245.3 |
| 3 | ratio | Largeur / Hauteur | 1.77 |
| 4 | r | Composante rouge de la couleur dominante | 142 |
| 5 | g | Composante verte de la couleur dominante | 98 |
| 6 | b | Composante bleue de la couleur dominante | 67 |

## 5.3 Implémentation

```python
# Vecteur utilisé pour l'entraînement ML (7 dimensions)
def build_features(images):
    rows = []
    for img in images:
        feat  = img.get('features') or {}
        w     = feat.get('width', 0)
        h     = feat.get('height', 0)
        size  = feat.get('sizeKb', 0)
        ratio = w / h if h > 0 else 1.0
        r, g, b = hex_to_rgb(feat.get('dominantColor', '#808080'))
        rows.append([w, h, size, ratio, r, g, b])
    return np.array(rows, dtype=float)
```

## 5.4 Stockage

Les features sont stockées dans le champ `features` du document `GalleryItem` en MongoDB, sous forme d'objet JSON. Elles sont incluses dans le JSON d'export des datasets, permettant leur utilisation directe par le script d'entraînement sans recalcul.

---

# 6. Versioning des datasets

## 6.1 Principe

Le versioning des datasets repose sur la création de **snapshots immuables** : à un instant T, toutes les images éligibles (statut `labeled`, `processed` ou `exported`) sont capturées dans une version numérotée. Cette version ne change jamais après sa création.

## 6.2 Mécanisme de création

1. L'administrateur clique sur **"Créer une version"** dans l'interface Datasets.
2. Le backend identifie toutes les images éligibles.
3. Un document `DatasetVersion` est créé avec :
   - Un numéro incrémental (`v1`, `v2`, `v3`...)
   - La liste des `imageIds` incluses
   - La liste des `labelsIncluded` (dédupliquée)
   - Le `imageCount`
4. Les images incluses passent au statut `exported` et reçoivent le tag de version.

## 6.3 Structure du JSON exporté

```json
{
  "version": "v1",
  "createdAt": "2026-04-13T10:00:00.000Z",
  "imageCount": 9,
  "labelsIncluded": ["fade", "afro", "barbe", "dégradé", "taper"],
  "description": "Première version de production",
  "images": [
    {
      "_id": "...",
      "url": "/uploads/gallery/image.jpg",
      "labels": ["fade", "barbe"],
      "features": {
        "width": 1080,
        "height": 1350,
        "sizeKb": 312.4,
        "dominantColor": "#8E6347"
      }
    }
  ]
}
```

## 6.4 Garanties de traçabilité

- Chaque version est horodatée (`createdAt`).
- Les images incluses conservent la référence à leur version d'export.
- Les versions sont immuables : créer une nouvelle version ne modifie pas les précédentes.
- L'interface affiche l'historique complet des versions avec leurs statistiques.

---

# 7. Entraînement du modèle

## 7.1 Algorithme choisi

Le classificateur est un **RandomForest multi-label** implémenté avec scikit-learn. La stratégie `OneVsRestClassifier` permet de traiter indépendamment chaque label (un même exemple peut avoir plusieurs labels simultanément).

## 7.2 Pipeline d'entraînement

```
dataset.json
     │
     ▼
build_features()     → vecteur 7D [w, h, sizeKb, ratio, r, g, b]
     │
     ▼
MultiLabelBinarizer  → matrice binaire y [n_images × n_labels]
     │
     ▼
train_test_split()   → 80% train / 20% test (random_state=42)
     │
     ▼
OneVsRestClassifier(RandomForestClassifier(n_estimators=100))
     │
     ▼
clf.predict()        → labels prédits
     │
     ▼
classification_report() + accuracy_score()
     │
     ▼
pickle.dump()        → model.pkl
```

## 7.3 Paramètres du modèle

| Paramètre | Valeur | Justification |
|---|---|---|
| n_estimators | 100 | Bon compromis précision/vitesse |
| test_size | 0.2 | 80/20 split standard |
| random_state | 42 | Reproductibilité |
| Stratégie multi-label | OneVsRest | Indépendance des labels |

## 7.4 Métriques d'évaluation

Le script génère automatiquement :
- **Accuracy exacte** : proportion d'images où tous les labels sont correctement prédits
- **Precision / Recall / F1-score** par label : performances détaillées
- **Support** : nombre d'exemples par label dans le jeu de test

## 7.5 Utilisation du modèle sauvegardé

```python
import pickle
model = pickle.load(open('model.pkl', 'rb'))
features = [[1080, 1350, 312.4, 0.8, 142, 98, 67]]
pred = model['clf'].predict(features)
labels = model['mlb'].inverse_transform(pred)
```

## 7.6 Limitations et perspectives

Avec un dataset de moins de 50 images, les performances restent limitées. En production, un dataset de plusieurs centaines d'images par label serait nécessaire. L'architecture est conçue pour monter en charge sans modification : il suffit de labéliser davantage d'images et de créer une nouvelle version.

---

# 8. Visualisation & supervision

## 8.1 Funnel Pipeline

L'interface Pipeline affiche un funnel interactif montrant le volume d'images par statut. Chaque barre est cliquable et filtre la liste des images. L'administrateur identifie ainsi instantanément les goulots d'étranglement (ex : beaucoup d'images `raw` non encore validées).

## 8.2 Graphique de croissance (8 semaines)

Un diagramme en barres affiche le nombre d'images ajoutées chaque semaine sur les 8 dernières semaines. Il permet de suivre le rythme d'alimentation du dataset et d'anticiper les besoins de labélisation.

## 8.3 Distribution des labels

Un graphique horizontal affiche la distribution des labels parmi toutes les images labélisées. Il permet d'identifier les classes sous-représentées, un indicateur clé de la qualité du dataset pour l'entraînement.

## 8.4 Statistiques de versions

Chaque version de dataset affiche : nombre d'images, labels inclus, date de création, et un bouton d'export JSON direct.

---

# 9. Recommandation client par IA

## 9.1 Principe

La page "Ma Coupe Idéale" permet à un client d'obtenir une recommandation personnalisée de style de coupe à partir de son visage, sans créer de compte. L'analyse est réalisée **entièrement dans le navigateur** (aucune donnée n'est envoyée vers un serveur externe).

## 9.2 Détection de la forme du visage

La bibliothèque **MediaPipe Face Landmarker** (Google) détecte 468 points de repère du visage dans l'image. À partir de ces landmarks, on calcule :

| Mesure | Landmarks utilisés | Description |
|---|---|---|
| Hauteur du visage | 10 (front) → 152 (menton) | Distance verticale |
| Largeur des pommettes | 234 → 454 | Point le plus large |
| Largeur de la mâchoire | 172 → 397 | Ligne mandibulaire |
| Largeur du front | 70 → 300 | Tempes |

**Algorithme de classification :**
```
ratio         = hauteur / largeur pommettes
jawRatio      = largeur mâchoire / largeur pommettes
foreheadRatio = largeur front / largeur pommettes

si ratio > 1.60              → Oblongue
si ratio < 1.20 et jaw > 0.85 → Ronde
si front > 1.08 et jaw < 0.72 → Cœur
si jaw > 0.80 et ratio ≤ 1.55  → Carrée
sinon                          → Ovale
```

## 9.3 Détection de la teinte de peau

7 points du visage (front, joues) sont échantillonnés pour calculer la couleur moyenne de la peau. La luminosité HSL détermine la teinte :

| Teinte | Luminosité HSL | Texture de cheveux estimée |
|---|---|---|
| Clair | > 58% | Lisses à ondulés |
| Médium | 36–58% | Ondulés à bouclés |
| Foncé | < 36% | Crépus à bouclés serrés |

## 9.4 Recommandations croisées

Les labels recommandés sont calculés par **intersection** entre les styles adaptés à la forme du visage et les styles compatibles avec la texture de cheveux estimée :

| Teinte | Styles exclus | Styles disponibles |
|---|---|---|
| Clair | afro, tresse | fade, taper, dégradé, burst-fade, barbe, rasage |
| Médium | aucun | tous les styles |
| Foncé | aucun | afro, tresse, burst-fade, barbe, taper, dégradé |

La galerie est ensuite filtrée pour n'afficher que les photos correspondant aux labels recommandés, créant un parcours client personnalisé.

---

# 10. Bonnes pratiques & gouvernance

## 10.1 Séparation fichiers / métadonnées

Conformément aux bonnes pratiques, le projet sépare strictement :
- **Fichiers images** → stockage sur disque (`/uploads/gallery/`)
- **Métadonnées** → MongoDB (statut, labels, features, références)

Cette séparation permet de faire évoluer indépendamment le stockage (migration vers S3, CDN) sans toucher à la base de données.

## 10.2 Versioning immuable

Les snapshots de datasets sont immuables par conception. Une fois créée, une version ne peut pas être modifiée. Cette propriété garantit la **reproductibilité** des entraînements : en relançant `train.py` sur le même fichier JSON, on obtient exactement le même modèle.

## 10.3 Authentification & autorisations

- Authentification JWT avec refresh token
- Séparation des rôles : `client` et `admin`
- Guards NestJS sur toutes les routes sensibles
- Support OAuth2 Google

## 10.4 Protection des données

- Les photos personnelles ne sont pas partagées entre utilisateurs
- L'analyse MediaPipe est réalisée localement dans le navigateur
- Aucune donnée biométrique n'est transmise à un serveur externe

---

# 11. Conclusion & perspectives

## 11.1 Bilan

DataCut répond à l'ensemble des exigences du projet :

| Exigence | Réalisé |
|---|---|
| Architecture détaillée de la plateforme | ✅ |
| Schéma de base de données documenté | ✅ |
| Pipeline de données (5 statuts) | ✅ |
| Extraction de features automatique | ✅ |
| Versioning des datasets (snapshots immuables) | ✅ |
| Alimentation d'un modèle ML | ✅ |
| Visualisation des flux et indicateurs | ✅ |
| Démonstration fonctionnelle | ✅ |
| Séparation fichiers / métadonnées | ✅ |

## 11.2 Perspectives d'évolution

**Court terme :**
- Augmenter le dataset (objectif : 100+ images par label)
- Ajouter une détection de forme de visage plus précise (CNN entraîné sur des visages)
- Intégrer un stockage cloud (AWS S3, Cloudinary)

**Moyen terme :**
- Automatiser le pipeline (ingestion batch depuis des sources externes)
- Ajouter un mécanisme de détection de dérive des données (data drift)
- Exposer le modèle via une API REST pour des prédictions en temps réel

**Long terme :**
- Remplacer le RandomForest par un modèle de vision par ordinateur (CNN, Vision Transformer)
- Intégrer un système de réentraînement automatique déclenché par l'ajout d'un nouveau dataset
