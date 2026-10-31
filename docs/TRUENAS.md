# Installation auf TrueNAS SCALE

Für TrueNAS SCALE 24.10 („Electric Eel“) und neuer. Dauert etwa eine Minute, es muss nichts
vorbereitet oder ausgedacht werden.

## 1. App anlegen

1. In TrueNAS **Apps** öffnen und auf **Discover Apps** klicken.
2. Oben rechts auf das Menü **⋮** und dann **Install via YAML** wählen.
3. Als Namen `oberstufen-planer` eintragen und diesen Text einfügen:

   ```yaml
   services:
     oberstufen-planer:
       image: ghcr.io/rp998c/oberstufen-planer:latest
       ports:
         - '3000:3000'
       volumes:
         - data:/data
       restart: unless-stopped

   volumes:
     data:
   ```

4. **Save** klicken. Nach kurzer Zeit steht die App auf **Running**.

## 2. Loslegen

`http://<IP-deines-TrueNAS>:3000` im Browser öffnen, ein Passwort festlegen – fertig.
Danach führt die App durch die Fächerwahl.

## Optional

**Daten in einem eigenen Dataset** (z. B. für Snapshots): erst ein Dataset anlegen, etwa
`tank/apps/oberstufen-planer`, und dann diese Variante verwenden. Die Rechte setzt die App selbst.

```yaml
services:
  oberstufen-planer:
    image: ghcr.io/rp998c/oberstufen-planer:latest
    ports:
      - '3000:3000'
    environment:
      PUID: 568
      PGID: 568
    volumes:
      - /mnt/tank/apps/oberstufen-planer:/data
    restart: unless-stopped
```

**Anderer Port:** Ist Port 3000 schon belegt, die linke Zahl ändern, z. B. `'3080:3000'`.

**Passwort vergessen:** In TrueNAS bei der App auf **Shell** klicken und `reset-password`
eingeben. Beim nächsten Aufruf fragt die App nach einem neuen Passwort; die Daten bleiben erhalten.

**Zugriff von unterwegs / Push-Benachrichtigungen:** Dafür braucht die App HTTPS, z. B. über einen
Reverse-Proxy (Nginx Proxy Manager, Caddy, Traefik) oder ein VPN wie Tailscale. Erinnerungen über
die ntfy-App funktionieren auch ohne HTTPS.

**Aktualisieren:** Neue Versionen erscheinen als neues Image `latest`. In TrueNAS die App aktualisieren
bzw. das Image neu ziehen und die App neu starten. Die Daten bleiben im Volume erhalten.

**Sichern:** In der App unter **Mehr → Einstellungen → Daten** eine Sicherung herunterladen.
