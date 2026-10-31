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
         - published: 3000 # ← Port auf deinem TrueNAS – hier ändern, z. B. 8080
           target: 3000 # Port im Container – so lassen
       volumes:
         - data:/data
       restart: unless-stopped

   volumes:
     data:
   ```

   Ist Port 3000 schon belegt, einfach die Zahl hinter `published:` ändern.

4. **Save** klicken. Nach kurzer Zeit steht die App auf **Running**.

## 2. Loslegen

`http://<IP-deines-TrueNAS>:3000` im Browser öffnen (bzw. mit deinem Port), ein Passwort festlegen – fertig.
Danach führt die App durch die Fächerwahl.

## Optional

**Daten in einem eigenen Dataset** (z. B. für Snapshots): erst ein Dataset anlegen, etwa
`tank/apps/oberstufen-planer`, und dann diese Variante verwenden. Die Rechte setzt die App selbst.

```yaml
services:
  oberstufen-planer:
    image: ghcr.io/rp998c/oberstufen-planer:latest
    ports:
      - published: 3000 # Port auf deinem TrueNAS
        target: 3000
    environment:
      PUID: 568
      PGID: 568
    volumes:
      - /mnt/tank/apps/oberstufen-planer:/data
    restart: unless-stopped
```

**Anderer Port:** Die Zahl hinter `published:` ist der Port, unter dem du die App erreichst – z. B.
`published: 8080`, dann `http://<IP-deines-TrueNAS>:8080` öffnen. `target: 3000` bleibt immer gleich.

**Passwort vergessen:** In TrueNAS bei der App auf **Shell** klicken und `reset-password`
eingeben. Beim nächsten Aufruf fragt die App nach einem neuen Passwort; die Daten bleiben erhalten.

**Zugriff von unterwegs / Push-Benachrichtigungen:** Dafür braucht die App HTTPS, z. B. über einen
Reverse-Proxy (Nginx Proxy Manager, Caddy, Traefik) oder ein VPN wie Tailscale. Erinnerungen über
die ntfy-App funktionieren auch ohne HTTPS.

**Aktualisieren:** Neue Versionen erscheinen als neues Image `latest`. In TrueNAS die App aktualisieren
bzw. das Image neu ziehen und die App neu starten. Die Daten bleiben im Volume erhalten.

**Sichern:** In der App unter **Mehr → Einstellungen → Daten** eine Sicherung herunterladen.
