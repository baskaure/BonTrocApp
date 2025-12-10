# 🔧 Résolution de l'erreur "Accès bloqué" Google OAuth

## ❌ Erreur rencontrée

```
Accès bloqué : erreur d'autorisation
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy
Erreur 400 : invalid_request
```

## 🔍 Causes possibles

Cette erreur se produit généralement quand :
1. L'application est en mode **"Testing"** et l'utilisateur n'est pas dans la liste des testeurs
2. L'écran de consentement OAuth n'est pas correctement configuré
3. L'URL de redirection ne correspond pas exactement

---

## ✅ Solution : Configurer l'écran de consentement dans Google Cloud Console

### Étape 1 : Accéder à l'écran de consentement

1. **Allez dans Google Cloud Console**
   - [https://console.cloud.google.com](https://console.cloud.google.com)
   - Sélectionnez votre projet **TrocAPP**

2. **Ouvrez l'écran de consentement**
   - Menu gauche → **"APIs & Services"** → **"OAuth consent screen"**
   - Ou directement : [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)

### Étape 2 : Configurer l'écran de consentement

#### Si c'est la première fois (pas encore configuré) :

1. **Choisissez le type d'utilisateur**
   - Sélectionnez **"External"** (pour permettre à tous les utilisateurs Google de se connecter)
   - Cliquez sur **"Create"**

2. **Remplissez les informations de l'application**
   - **App name** : `BonTroc` ou `TrocApp`
   - **User support email** : Votre email (ex: `maitrekano@gmail.com`)
   - **App logo** : (optionnel) Vous pouvez uploader un logo
   - **App domain** : (optionnel) Laissez vide pour l'instant
   - **Authorized domains** (Domaines autorisés) : 
     - ⚠️ **IMPORTANT** : Ce champ est UNIQUEMENT pour les domaines web (ex: `example.com`, `supabase.co`)
     - ❌ **NE PAS ajouter** `bontroc://auth/callback` ici (ce n'est pas un domaine)
     - ✅ Vous pouvez ajouter : `supabase.co` (sans le préfixe `https://`)
     - ✅ Vous pouvez ajouter : `netlify.app` (si vous utilisez Netlify)
     - ⚠️ **Format** : Juste le domaine, sans `http://`, `https://`, ou `://`
   - **Developer contact information** : Votre email (ex: `maitrekano@gmail.com`)
   
   Cliquez sur **"Save and Continue"**

3. **Configurer les Scopes (étendues)**
   - Cliquez sur **"Add or Remove Scopes"**
   - Par défaut, Google sélectionne automatiquement les scopes de base
   - Pour une authentification simple, gardez les scopes par défaut :
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Cliquez sur **"Update"** puis **"Save and Continue"**

4. **Ajouter des utilisateurs de test** (IMPORTANT si l'app est en mode Testing)
   - Cliquez sur **"Add Users"**
   - Ajoutez votre email : `maitrekano@gmail.com`
   - Ajoutez tous les emails qui doivent pouvoir tester l'app
   - ⚠️ **IMPORTANT** : Seuls les emails ajoutés ici pourront se connecter si l'app est en mode "Testing"
   - Cliquez sur **"Add"** puis **"Save and Continue"**

5. **Résumé**
   - Vérifiez toutes les informations
   - Cliquez sur **"Back to Dashboard"**

#### Si l'écran de consentement existe déjà :

1. **Vérifiez le statut de publication**
   - En haut de la page, vous verrez le statut : **"Testing"** ou **"In production"**
   
2. **Si le statut est "Testing"** :
   - Cliquez sur **"Test users"** ou **"ADD USERS"**
   - Ajoutez votre email : `maitrekano@gmail.com`
   - ⚠️ **CRITIQUE** : Sans cela, vous ne pourrez pas vous connecter !
   - Cliquez sur **"Save"**

3. **Si vous voulez publier l'app** (pour que tous les utilisateurs puissent se connecter) :
   - Cliquez sur **"PUBLISH APP"** en haut
   - ⚠️ **ATTENTION** : Cela rendra l'app accessible à tous les utilisateurs Google
   - Google peut demander une vérification si vous demandez des scopes sensibles

### Étape 3 : Configurer les domaines autorisés (si nécessaire)

⚠️ **IMPORTANT - Ne confondez pas avec les Redirect URIs !**

1. **Dans "OAuth consent screen"**, section **"Authorized domains"** (Domaines autorisés) :
   - Ce champ est **UNIQUEMENT** pour les domaines web
   - ✅ **Format correct** : `supabase.co` (sans `https://`)
   - ✅ **Format correct** : `netlify.app` (sans `https://`)
   - ❌ **Format incorrect** : `bontroc://auth/callback` (ce n'est pas un domaine)
   - ❌ **Format incorrect** : `https://supabase.co` (ne pas inclure le protocole)
   
2. **Si vous avez ajouté `bontroc://auth/callback` par erreur** :
   - Supprimez-le immédiatement
   - Ce champ n'accepte que des domaines web valides

### Étape 4 : Vérifier les URLs de redirection

1. **Retournez dans "Credentials"**
   - Menu gauche → **"APIs & Services"** → **"Credentials"**

2. **Vérifiez votre OAuth Client ID**
   - Cliquez sur votre OAuth Client ID (celui que vous avez créé)

3. **Vérifiez "Authorized redirect URIs"** (URI de redirection autorisés)
   - ⚠️ **C'est ICI** que vous configurez les URLs de redirection
   - Doit contenir exactement : `https://cuxypeejwglisqidxwfj.supabase.co/auth/v1/callback`
   - ⚠️ Vérifiez que l'URL est **exactement** la même (pas d'espace, pas de slash à la fin)
   - ❌ **NE PAS ajouter** `bontroc://auth/callback` ici non plus (Google ne l'accepte pas)

---

## 🔍 Vérifications supplémentaires

### Vérifier dans Supabase Dashboard

1. **Allez dans Supabase Dashboard**
   - [https://supabase.com](https://supabase.com)
   - Sélectionnez votre projet

2. **Vérifiez la configuration Google**
   - **Authentication** → **Providers** → **Google**
   - Vérifiez que :
     - Google est **activé** (toggle ON)
     - Le **Client ID** correspond à celui de Google Cloud Console
     - Le **Client Secret** correspond à celui de Google Cloud Console

3. **Vérifiez les Redirect URLs**
   - **Authentication** → **URL Configuration**
   - Dans **"Redirect URLs"**, vérifiez que `bontroc://auth/callback` est bien présent

---

## 🧪 Test

Après avoir fait ces modifications :

1. **Attendez 5-10 minutes** (les changements peuvent prendre un peu de temps à se propager)

2. **Essayez de vous connecter à nouveau**
   - Si l'app est en mode "Testing", assurez-vous que votre email est dans la liste des testeurs
   - Si l'app est "In production", tous les utilisateurs Google peuvent se connecter

3. **Vérifiez les logs**
   - Dans la console de votre app, vérifiez les messages d'erreur
   - Dans Google Cloud Console → **APIs & Services** → **Dashboard**, vérifiez les erreurs

---

## ⚠️ Erreurs courantes

### "redirect_uri_mismatch"
- **Cause** : L'URL de redirection dans Google Cloud Console ne correspond pas exactement
- **Solution** : Vérifiez que l'URL est exactement : `https://VOTRE_PROJECT_ID.supabase.co/auth/v1/callback`

### "access_denied"
- **Cause** : L'utilisateur n'est pas dans la liste des testeurs (app en mode Testing)
- **Solution** : Ajoutez l'email dans "Test users" de l'écran de consentement

### "invalid_client"
- **Cause** : Le Client ID ou Client Secret est incorrect dans Supabase
- **Solution** : Vérifiez que les credentials dans Supabase correspondent à ceux de Google Cloud Console

---

## 📝 Résumé des actions à faire

1. ✅ **Google Cloud Console** → **OAuth consent screen** → Ajouter votre email dans "Test users"
2. ✅ **Google Cloud Console** → **Credentials** → Vérifier que l'URL de redirection Supabase est correcte
3. ✅ **Supabase Dashboard** → **Authentication** → **Providers** → Vérifier les credentials Google
4. ✅ **Supabase Dashboard** → **URL Configuration** → Vérifier que `bontroc://auth/callback` est présent
5. ✅ Attendre 5-10 minutes et réessayer

---

## 🆘 Si ça ne fonctionne toujours pas

1. Vérifiez les logs dans Google Cloud Console → **APIs & Services** → **Dashboard**
2. Vérifiez les logs dans Supabase Dashboard → **Logs**
3. Vérifiez la console de votre app pour voir les erreurs détaillées
4. Assurez-vous que vous utilisez le bon projet Google Cloud (TrocAPP)

