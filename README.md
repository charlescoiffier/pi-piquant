# π-piquant

[![pipeline](https://gitlab.com/charlescoiffier/pi-piquant/badges/main/pipeline.svg)](https://gitlab.com/charlescoiffier/pi-piquant/-/pipelines)

Réinterprétation web des œuvres « pi-piquant » de François Morellet : une suite de chiffres
(décimales de π par défaut) devient un tracé de segments égaux, dont les angles sont dictés par les chiffres.

**Application en ligne :** https://pi-piquant-b69e0d.gitlab.io/

## Conversions réversibles (texte et image)

Le texte et l'image sont convertis **sans perte** en chiffres 0-9, puis tracés comme n'importe quelle suite.

- **Un octet = 3 chiffres** : `bloc = (octet × 79 + 217) mod 1000`, écrit sur 3 chiffres. La formule est une
  permutation (79 est premier avec 1000), donc inversible ; le mélange garde les chiffres 0-9 équilibrés
  (écrire l'octet tel quel donnerait surtout des 0, 1 et 2).
- **Texte** : codé en UTF-8 (tous les alphabets, emojis compris), 3 chiffres par octet. Capacité : 33 333 octets.
- **Image** : niveaux de gris 8 bits (luminance, transparence composée sur du blanc). En-tête de 9 chiffres
  (largeur sur 4, hauteur sur 4, parcours sur 1), puis 3 chiffres par pixel dans l'ordre du parcours.
  Capacité : 33 330 pixels ; une image plus grande est réduite à l'import.
- **Retrouver le contenu** : `decodeText` (`src/digits/text.ts`) et `decodeImage` (`src/digits/image.ts`)
  inversent la conversion. Depuis le dessin, on retrouve les chiffres à partir des angles (angle = chiffre × angle
  unitaire, 0 comptant pour 10, sens alterné) ; c'est univoque tant que l'angle unitaire est ≤ 36°.

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires (Vitest)
npm run build      # build de production dans dist/
npm run generate:digits   # régénère src/data/digits.json (100 000 chiffres de π, e, φ, √2)
```

## Publication

Chaque push sur la branche par défaut déclenche le pipeline `.gitlab-ci.yml` (tests, build, GitLab Pages).
