# Dany1st Barber — Guide de déploiement

## Stack retenue

| Service | Usage | Prix/mois |
|---------|-------|-----------|
| **Hetzner CX11** | VPS Backend NestJS | ~4€ |
| **MongoDB Atlas M0** | Base de données | Gratuit |
| **Vercel** | Frontend Angular | Gratuit |
| **Cloudinary** | Stockage photos | Gratuit (25GB) |
| **UptimeRobot** | Monitoring | Gratuit |
| **Brevo (ex-Sendinblue)** | Emails transactionnels | Gratuit (300/jour) |
| **Domaine .fr** | DNS via Cloudflare | ~10€/an |
| **Total** | | **~5€/mois** |

---

## 1. MongoDB Atlas

1. Créer un compte sur [mongodb.com/atlas](https://mongodb.com/atlas)
2. Créer un cluster **M0 gratuit** (région : Frankfurt)
3. Créer un utilisateur DB (`dany1st` / mot de passe fort)
4. Autoriser l'IP du VPS Hetzner dans **Network Access**
5. Récupérer la connection string :
   ```
   mongodb+srv://dany1st:<password>@cluster0.xxxxx.mongodb.net/dany1st
   ```
6. Activer les **backups automatiques** quotidiens (onglet Backup)

---

## 2. Cloudinary (migration des uploads)

> ⚠️ Les fichiers uploadés localement sur le VPS sont perdus à chaque redéploiement.
> Il faut migrer multer vers Cloudinary avant la mise en prod.

1. Créer un compte sur [cloudinary.com](https://cloudinary.com)
2. Récupérer : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
3. Installer le package dans le backend :
   ```bash
   npm install cloudinary multer-storage-cloudinary
   ```
4. Remplacer le storage multer local par Cloudinary dans `gallery.controller.ts`

---

## 3. Hetzner VPS (Backend)

### Création du serveur
1. Créer un compte sur [hetzner.com](https://hetzner.com)
2. Créer un serveur **CX11** :
   - OS : Ubuntu 22.04
   - Région : Nuremberg (proche France)
   - Ajouter sa clé SSH
3. Récupérer l'IP publique du serveur

### Configuration initiale (SSH)
```bash
ssh root@<IP_SERVEUR>

# Mise à jour
apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2 (gestionnaire de processus)
npm install -g pm2

# Nginx
apt install -y nginx

# Certbot (HTTPS)
apt install -y certbot python3-certbot-nginx
```

### Déploiement du backend
```bash
# Cloner le projet
git clone https://github.com/AmauryGuindon/dany1stbarber.git /var/www/dany1st
cd /var/www/dany1st/backend

# Installer les dépendances
npm install

# Build
npm run build

# Créer le fichier .env
nano .env
```

### Contenu du fichier `.env`
```env
MONGODB_URI=mongodb+srv://dany1st:<password>@cluster0.xxxxx.mongodb.net/dany1st
JWT_SECRET=<chaine_aleatoire_longue>
JWT_EXPIRES_IN=7d
APP_URL=https://dany1st.fr
FRONTEND_URL=https://dany1st.fr

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<email_brevo>
SMTP_PASS=<cle_api_brevo>
MAIL_FROM=contact@dany1st.fr

CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
```

### Lancer avec PM2
```bash
cd /var/www/dany1st/backend
pm2 start dist/main.js --name dany1st-backend
pm2 save
pm2 startup  # Pour redémarrer automatiquement après reboot
```

### Configuration Nginx
```bash
nano /etc/nginx/sites-available/dany1st
```

```nginx
server {
    listen 80;
    server_name api.dany1st.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dany1st /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# HTTPS automatique
certbot --nginx -d api.dany1st.fr
```

---

## 4. Vercel (Frontend Angular)

1. Créer un compte sur [vercel.com](https://vercel.com)
2. Importer le repo GitHub `dany1stbarber`
3. Configurer le build :
   - **Framework** : Angular
   - **Build command** : `npm run build`
   - **Output directory** : `dist/dany1st/browser`
4. Ajouter la variable d'environnement :
   ```
   API_URL=https://api.dany1st.fr
   ```
5. Ajouter le domaine custom `dany1st.fr` dans les settings Vercel

---

## 5. DNS via Cloudflare

1. Créer un compte sur [cloudflare.com](https://cloudflare.com)
2. Ajouter le domaine `dany1st.fr`
3. Configurer les enregistrements DNS :

| Type | Nom | Valeur |
|------|-----|--------|
| A | `api` | `<IP_Hetzner>` |
| CNAME | `@` | `cname.vercel-dns.com` |
| CNAME | `www` | `cname.vercel-dns.com` |

---

## 6. UptimeRobot (Monitoring)

1. Créer un compte sur [uptimerobot.com](https://uptimerobot.com)
2. Ajouter deux monitors :
   - `https://dany1st.fr` (Frontend)
   - `https://api.dany1st.fr` (Backend)
3. Configurer les alertes par **email et SMS** en cas de downtime

---

## 7. Brevo (Emails)

1. Créer un compte sur [brevo.com](https://brevo.com)
2. Aller dans **SMTP & API** → générer une clé SMTP
3. Vérifier le domaine `dany1st.fr` (ajouter les enregistrements DNS SPF/DKIM dans Cloudflare)
4. Renseigner les infos dans le `.env` du backend

---

## Déploiement continu (mises à jour)

À chaque modification du code :

```bash
# Sur le VPS
cd /var/www/dany1st
git pull origin master
cd backend
npm install
npm run build
pm2 restart dany1st-backend
```

> 💡 À terme : automatiser via **GitHub Actions** pour un déploiement automatique à chaque push.

---

## Checklist avant mise en prod

- [ ] Variables d'environnement renseignées dans `.env`
- [ ] MongoDB Atlas : IP du VPS autorisée
- [ ] Cloudinary : migration des uploads effectuée
- [ ] HTTPS actif sur `api.dany1st.fr` et `dany1st.fr`
- [ ] Emails testés (confirmation RDV, reset password)
- [ ] UptimeRobot configuré
- [ ] Backups MongoDB Atlas activés
- [ ] PM2 configuré pour redémarrage automatique
