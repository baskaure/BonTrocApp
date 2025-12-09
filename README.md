# BonTroc - Application React Native

Application mobile de troc développée avec React Native et Expo, basée sur votre application web existante.

## Fonctionnalités

- ✅ Authentification (email/password et Google)
- ✅ Liste des annonces avec filtres
- ✅ Création d'annonces
- ✅ Propositions d'échange
- ✅ Profils utilisateurs
- ✅ Navigation mobile optimisée

## Configuration

### 1. Variables d'environnement

Créez un fichier `.env` à la racine du projet avec vos credentials Supabase :

```
EXPO_PUBLIC_SUPABASE_URL=votre_url_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
```

**Note :** Vous pouvez aussi utiliser la nouvelle clé `publishable` (format `sb_publishable_xxx`) au lieu de `anon` si votre projet Supabase la supporte.

### 2. Installation

```bash
npm install
```

Les dépendances suivantes sont déjà installées :
- `@supabase/supabase-js` - Client Supabase
- `@react-native-async-storage/async-storage` - Stockage local pour la session (requis par Supabase Auth)

### 3. Lancement

```bash
# Sur Windows PowerShell
$env:EXPO_NO_TELEMETRY="1"
npm run dev

# Ou directement
npx expo start
```

Puis :
- Appuyez sur `a` pour Android
- Appuyez sur `i` pour iOS
- Scannez le QR code avec Expo Go sur votre téléphone

## Structure du projet

```
app/
  ├── index.tsx          # Écran principal (liste des annonces)
  ├── landing.tsx        # Page d'accueil (non connecté)
  ├── auth.tsx           # Authentification
  ├── proposals.tsx      # Liste des propositions
  └── profile.tsx        # Profil utilisateur

components/
  ├── ListingCard.tsx           # Carte d'annonce
  ├── CreateListingModal.tsx    # Modal de création d'annonce
  └── ListingDetailModal.tsx    # Modal de détail d'annonce

lib/
  ├── supabase.ts        # Configuration Supabase et types
  └── auth-context.tsx   # Contexte d'authentification
```

## Notes

- L'application utilise la même base de données Supabase que votre application web
- Les fonctionnalités avancées (chat, contrats, échanges) peuvent être ajoutées progressivement
- Assurez-vous que votre projet Supabase a les mêmes tables que l'application web

