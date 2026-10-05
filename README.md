# π-piquant

[![pipeline](https://gitlab.com/charlescoiffier/pi-piquant/badges/main/pipeline.svg)](https://gitlab.com/charlescoiffier/pi-piquant/-/pipelines)

Une application web qui transforme une suite de chiffres (les décimales de π par défaut) en un dessin de
lignes brisées, d'après la série « pi-piquant » de François Morellet.

**Essayer l'application : https://pi-piquant-b69e0d.gitlab.io/**

Aucune installation : tout se passe dans le navigateur, et rien n'est envoyé à un serveur.

---

# Pour tout le monde

## Le projet en bref

François Morellet (1926–2016) était un artiste français qui composait ses œuvres à partir de règles simples,
appliquées sans intervention de sa main ni de son goût, et souvent avec humour. Dans sa série *pi-piquant*, la règle
est la suivante : on trace des segments de même longueur, et ce sont les **décimales de π** (3,14159265…) qui
décident de l'angle entre deux segments consécutifs. Le hasard apparent du nombre π donne des figures en étoile,
à la fois rigoureuses et imprévisibles.

Cette application applique le même principe, puis l'ouvre à d'autres suites de chiffres : d'autres nombres célèbres,
un texte ou une image. Elle ne remplace pas les œuvres, c'est une réinterprétation : chaque dessin porte d'ailleurs
la mention « d'après François Morellet ». Pour découvrir son travail : [francoismorellet.com](https://francoismorellet.com/).

## Comment un dessin se construit

1. Le premier segment est toujours **vertical**, tracé vers le haut.
2. Chaque chiffre donne l'**angle** entre le segment qui vient d'être tracé et le suivant :
   *angle = chiffre × angle unitaire*. Un angle de 0° ramènerait le segment sur le précédent ; le chiffre 0 compte
   pour **10** (comme dans l'œuvre), pour que chaque chiffre produise un angle différent.
3. Le **sens** de l'angle s'inverse à chaque sommet (un angle d'un côté, le suivant de l'autre), ce qui donne le
   caractère « piquant » de la ligne.
4. Tous les segments ont la même longueur.

Exemple avec π (3, 1, 4, 1, 5, 9…) et un angle unitaire de 10° : les premiers angles sont 30°, 10°, 40°, 10°, 50°,
90°… Le titre sous chaque dessin le rappelle : « π-piquant • 1 = 10° • 100 décimales ».

## Utiliser l'application

L'écran est blanc, avec une petite fenêtre de réglages que l'on peut **déplacer**, **replier** (bouton « – ») ou
**masquer** (touche `H`). Le bouton « i » en bas de la fenêtre ouvre une courte présentation de Morellet.

- **Naviguer dans le dessin** : molette ou pincement pour zoomer, glisser pour se déplacer, « Ajuster » pour
  tout recadrer.
- **À l'ouverture**, le nombre de décimales (entre 10 et 200) et l'angle unitaire (entre 1° et 90°) sont tirés au
  hasard : chaque visite propose un dessin différent.
- **Langue** : français ou anglais (bouton FR/EN en haut de la fenêtre).

### Ce que l'on peut dessiner (« Source »)

| Source | Ce que ça fait |
|---|---|
| **π**, **e**, **φ** (nombre d'or), **√2** | Les décimales de ces nombres, jusqu'à 100 000. |
| **Chiffres** | Une suite de chiffres de son choix (une date, un numéro…). Les autres caractères sont ignorés. |
| **Texte** | N'importe quel texte (accents, autres alphabets, emojis) devient une suite de chiffres. |
| **Image** | Une image devient une suite de chiffres (niveaux de gris), lue selon un parcours au choix : lignes, serpentin, spirale ou courbe de Hilbert. |

Pour le texte et l'image, la conversion est **réversible** : le dessin contient toute l'information, et en
théorie on peut retrouver le texte ou l'image à partir des chiffres (voir la partie technique). Le texte ou l'image est
toujours utilisé en entier, sans réglage du nombre de décimales.

### Les réglages

| Réglage | Effet |
|---|---|
| Nb de décimales | Combien de chiffres sont tracés (π, e, φ, √2) : de 1 à 100 000. |
| Long. segment | Longueur des segments (de 1 à 100). Elle modifie surtout l'épaisseur apparente du trait. |
| Angle unitaire | L'angle qui correspond au chiffre 1 (de 0° à 360°) ; c'est le réglage qui change le plus l'allure du dessin. |
| Sens 1er angle | Anti-horaire (comme dans l'œuvre) ou horaire : donne l'image miroir. |
| Trait, Fond, Épaisseur | Couleurs et épaisseur de la ligne ; un bouton « Mode sombre » inverse fond et trait. |
| Titre | Affiche ou masque la légende sous le dessin (à l'écran et dans les exports). |
| Animation | « Animer » dessine le tracé segment par segment (de 1 à 5000 segments par seconde) ; « Tout afficher » termine l'animation. |

Les curseurs ont des **crans** (petits repères sous la piste) pour retrouver facilement des valeurs courantes, et chaque
champ numérique accepte aussi une valeur précise saisie au clavier.

### Enregistrer et partager

- **PNG** (2048, 4096 ou 8192 pixels), **SVG** (dessin vectoriel, agrandissable sans perte) et **PDF** (A4).
  Les fichiers portent un nom explicite, par exemple `pi-piquant_10deg_100dec.png`.
- **Copier lien** : le lien reproduit exactement le même dessin chez la personne qui l'ouvre. Il est **lisible**
  et décrit tous les réglages, par exemple
  `…/#source=pi&decimales=100&angle=10&segment=10&sens=anti-horaire&epaisseur=0.5&trait=111111&fond=ffffff&titre=oui&vitesse=500&langue=fr` ;
  on peut le modifier à la main. Il ne contient pas l'image si la source en est une. La barre d'adresse affiche ce lien
  et revient à l'adresse courte dès qu'un réglage change.
- **Ouvrir un lien** : coller un lien dans la barre d'adresse (même sur la page déjà ouverte), ou faire Cmd/Ctrl + V
  dans la page (hors d'un champ de saisie), applique tous ses réglages.
- **JSON** : enregistrer les réglages dans un fichier (↓ JSON) puis les rouvrir plus tard (↑ JSON).

### Limites

- 100 000 chiffres au maximum par dessin.
- Texte : environ 33 000 octets (une lettre ordinaire = 1 octet, une lettre accentuée = 2, un emoji = 4).
- Image : environ 33 000 pixels ; une image plus grande est réduite automatiquement à l'import (le message en bas
  de la fenêtre l'indique).
- Pour retrouver le contenu depuis le dessin, l'angle unitaire doit rester **inférieur ou égal à 36°** : au-delà,
  des chiffres différents donnent le même angle (à 90°, les chiffres 1, 5 et 9 sont identiques).

---

# Pour les développeurs

## Démarrage

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm test           # tests unitaires (Vitest)
npm run build      # vérification des types + build de production dans dist/
npm run preview    # sert le build de production
npm run generate:digits   # régénère src/data/digits.json (100 000 chiffres de π, e, φ, √2)
```

Pour la régénération des données, `npx vite-node scripts/generate-digits.ts --verify` recoupe en plus π avec
l'API pi.delivery à quatre positions.

## Technologies

TypeScript + [Vite](https://vite.dev/), sans framework : rendu **Canvas 2D**, interface en DOM natif.
[Vitest](https://vitest.dev/) pour les tests, [jsPDF](https://github.com/parallax/jsPDF) pour l'export PDF
(chargé à la demande). Application 100 % statique, aucun serveur.

## Organisation du code

| Dossier / fichier | Rôle |
|---|---|
| `src/main.ts` | Orchestration : état, recalcul, animation, zoom, exports, lien de partage, messages d'état. |
| `src/geometry/path.ts` | Règle de tracé (fonction pure) : chiffres → points. |
| `src/digits/` | Sources de chiffres → `Uint8Array` de 0 à 9. `embedded.ts` (fichier JSON embarqué), `pi.ts` (API pi.delivery + cache IndexedDB, en secours), `constants.ts` (e, φ, √2, π calculés en BigInt), `free.ts`, `text.ts`, `image.ts`, `bytecode.ts` (octet ⇄ 3 chiffres). |
| `src/render/` | `canvas.ts` (dessin), `viewport.ts` (zoom, déplacement, pincement), `export.ts` (PNG, SVG, PDF, JSON). |
| `src/ui/` | `panel.ts` (fenêtre de réglages), `info.ts` (modale « À propos »), `i18n.ts` (FR/EN), `state.ts` (paramètres, bornes, lien), `title.ts` (légende et noms de fichiers). |
| `src/data/digits.json` | 100 000 chiffres de π, e, φ, √2 (400 Ko), généré par `scripts/generate-digits.ts`. |
| `tests/digits.test.ts` | Tests : géométrie, constantes, conversions, aller-retour texte/image, titre, paramètres. |

## Données de π et des constantes

Les 100 000 premiers chiffres de π, e, φ et √2 sont **embarqués** dans `src/data/digits.json` (chargé à la demande, donc
absent du premier chargement de la page). L'application fonctionne ainsi hors ligne et sans attente. L'API
[pi.delivery](https://pi.delivery/) (1000 chiffres par requête, mis en cache dans IndexedDB) et le calcul local en BigInt
ne servent que de secours si le fichier est indisponible. Les suites commencent par le chiffre entier : `3141592653…`,
`2718281828…`, `1618033988…`, `1414213562…`.

## Règle de tracé

`buildPath` (`src/geometry/path.ts`) : premier segment vertical vers le haut ; pour chaque chiffre `d`, le cap tourne de
`180° ± (d || 10) × angleUnitaire` (le signe s'inverse à chaque sommet, le premier suit le réglage « Sens 1er angle »), puis
on avance d'un segment. *n* chiffres donnent donc *n + 1* segments. L'épaisseur du trait est exprimée en unités du dessin
(avec un minimum de 0,4 px à l'écran), pour que le dessin reste identique à toutes les échelles.

## Conversions réversibles (texte et image)

Le texte et l'image sont convertis **sans perte** en chiffres 0-9, puis tracés comme n'importe quelle suite.

- **Un octet = 3 chiffres** : `bloc = (octet × 79 + 217) mod 1000`, écrit sur 3 chiffres. La formule est une
  permutation (79 est premier avec 1000), donc inversible ; le mélange garde les chiffres 0-9 équilibrés
  (écrire l'octet tel quel donnerait surtout des 0, 1 et 2). Les constantes ont été choisies par recherche exhaustive,
  puis validées sur un texte écarté de la recherche.
- **Texte** : codé en UTF-8 (tous les alphabets, emojis compris), 3 chiffres par octet. Capacité : 33 333 octets ;
  au-delà, le texte est coupé à une frontière de caractère.
- **Image** : niveaux de gris 8 bits (luminance Rec. 709, transparence composée sur du blanc). En-tête de 9 chiffres
  (largeur sur 4, hauteur sur 4, parcours sur 1), puis 3 chiffres par pixel dans l'ordre du parcours.
  Capacité : 33 330 pixels ; une image plus grande est réduite à l'import (`fitImageSize`).
- **Retrouver le contenu** : `decodeText` (`src/digits/text.ts`) et `decodeImage` (`src/digits/image.ts`)
  inversent la conversion, et les tests vérifient les allers-retours. Depuis le dessin, on retrouve les chiffres à partir
  des angles (angle = chiffre × angle unitaire, 0 comptant pour 10, sens alterné) ; c'est univoque tant que
  l'angle unitaire est ≤ 36°.

## Lien de partage

Les réglages sont écrits dans le fragment de l'adresse (`#…`, jamais envoyé à un serveur), en paires `nom=valeur`
séparées par `&`, avec des noms en français :

```
#source=pi&decimales=100&angle=10&segment=10&sens=anti-horaire&epaisseur=0.5&trait=111111&fond=ffffff&titre=oui&vitesse=500&langue=fr
#source=texte&angle=24&texte=François%20Morellet&segment=10&sens=horaire&epaisseur=0.5&trait=cc3333&fond=111111&titre=oui&vitesse=500&langue=fr
```

| Paramètre | Valeurs | Écrit pour… |
|---|---|---|
| `source` | `pi`, `e`, `phi`, `racine2`, `chiffres`, `texte`, `image` | toutes les sources |
| `decimales` | 1 à 100 000 | π, e, φ, √2 |
| `angle` | degrés (`.` ou `,` acceptés) | toutes les sources |
| `chiffres` | suite de chiffres | source `chiffres` |
| `texte` | texte | source `texte` |
| `parcours` | `lignes`, `serpentin`, `spirale`, `hilbert` | source `image` |
| `segment`, `epaisseur`, `vitesse` | nombres | toutes les sources |
| `sens` | `horaire`, `anti-horaire` | toutes les sources |
| `trait`, `fond` | couleur hexadécimale sans `#` (3 ou 6 chiffres en lecture) | toutes les sources |
| `titre` | `oui`, `non` | toutes les sources |
| `langue` | `fr`, `en` | toutes les sources |

Le lien décrit **tout l'état utile** pour la source choisie, valeurs par défaut comprises : il reste exact même si les
valeurs par défaut changent un jour. Seuls les réglages sans effet pour la source sont omis (pas de `texte` pour π, pas de
`decimales` pour un texte). À la lecture, les clés inconnues sont ignorées et les valeurs invalides ramenées aux valeurs
par défaut ou aux bornes (`sanitize`). Un fragment sans aucun réglage reconnu (y compris l'ancien format `#p=…`) ouvre
l'application avec ses valeurs aléatoires. Les valeurs sont encodées comme dans une adresse (`%20` pour l'espace,
`%26` pour `&`…), mais les caractères accentués, guillemets, emojis et la ponctuation courante (`, ; : / ? @`) restent
lisibles. L'image n'est jamais incluse.

Un lien est appliqué dans deux cas, gérés dans `src/main.ts` : changement du fragment sur la page déjà ouverte
(événement `hashchange`, par exemple un lien collé dans la barre d'adresse) et collage dans la page (événement `paste`,
ignoré dans les champs de saisie). Le code d'encodage et de décodage est dans `encodeParams` / `decodeParams`
(`src/ui/state.ts`).

## Publication

Chaque push sur la branche par défaut déclenche le pipeline `.gitlab-ci.yml` : installation (`npm ci`), tests, build, puis
déploiement sur GitLab Pages (image `node:22-alpine`, dossier `public/`).

- `vite.config.ts` utilise `base: './'` (chemins relatifs), car le site est servi dans un sous-dossier.
- GitLab Pages envoie `cache-control: max-age=600` : après un déploiement, un navigateur peut garder l'ancienne version
  jusqu'à 10 minutes ; un rechargement forcé (Cmd/Ctrl + Maj + R) affiche la nouvelle.
- L'adresse publique du site apparaît dans **Deploy → Pages** sur GitLab ; le badge en tête de ce fichier reflète l'état
  du dernier pipeline.
