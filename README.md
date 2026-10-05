# π-piquant

Réinterprétation web des œuvres « pi-piquant » de François Morellet : une suite de chiffres
(décimales de π par défaut) devient un tracé de segments égaux, dont les angles sont dictés par les chiffres.

**Application en ligne :** https://charlescoiffier.gitlab.io/pi-piquant/

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
