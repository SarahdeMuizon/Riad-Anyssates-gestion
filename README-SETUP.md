# Riad Anyssates Gestion — Setup

## 1. Installer les dépendances

```bash
cd ~/Desktop/Riad-Anyssates-gestion
npm install
```

## 2. Créer une base Turso

1. Va sur https://app.turso.tech
2. Crée une nouvelle base "riad-anyssates-gestion"
3. Va dans **Connect** → copie :
   - `TURSO_DATABASE_URL` (ex: `libsql://riad-anyssates.turso.io`)
   - Génère un **Auth Token** → copie `TURSO_AUTH_TOKEN`

## 3. Configurer les variables d'environnement

```bash
cp ~/Desktop/Riad-Anyssates-gestion/.env.local.example ~/Desktop/Riad-Anyssates-gestion/.env.local
```

Édite `.env.local` et colle tes valeurs Turso.

## 4. Lancer en local (optionnel)

```bash
npm run dev
```

Puis appelle une fois pour créer les tables :
```
POST http://localhost:3000/api/init
```

## 5. Déployer sur Vercel

```bash
cd ~/Desktop/Riad-Anyssates-gestion
git add .
git commit -m "Migration TypeScript Next.js v2"
git push
```

Sur Vercel, dans Settings → Environment Variables, ajoute :
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET` (n'importe quelle chaîne, ex: `riad2026secret`)

## 6. Initialiser la base (une seule fois)

Après déploiement, appelle :
```
POST https://ton-app.vercel.app/api/init
```

## Accès

- **Manager** : `https://ton-app.vercel.app` → PIN : `gestion2026`
- **Employé** : `https://ton-app.vercel.app/employee?emp=TOKEN`
