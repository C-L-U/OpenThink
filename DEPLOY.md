# Despliegue: VPS y Cloudflare Pages

Esta guía usa Ubuntu/Debian, systemd y Nginx. Sustituye los dominios y rutas de ejemplo. El backend debe ser accesible por HTTPS: el navegador envía las claves de los proveedores a ese servidor. No incluyas claves en variables `VITE_`, porque se publican en el navegador.

## Backend en el VPS

1. Instala Python 3.12 o posterior, su módulo venv, Nginx y Certbot. Copia el repositorio a `/opt/openthink` y crea un usuario de servicio sin privilegios llamado `openthink` con acceso de lectura al código.
2. Instala las dependencias:

   ```bash
   cd /opt/openthink/backend
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

3. Crea `/etc/systemd/system/openthink.service`:

   ```ini
   [Unit]
   Description=OpenThink API
   After=network-online.target
   Wants=network-online.target

   [Service]
   User=openthink
   WorkingDirectory=/opt/openthink/backend
   Environment=OPENTHINK_CORS_ORIGINS=https://app.example.com
   ExecStart=/opt/openthink/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
   Restart=on-failure
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```

   Para varios dominios del frontend, separa los orígenes exactos con comas, sin barras finales. El límite por IP está en memoria y es por proceso; utiliza una sola instancia si dependes de ese límite. CORS no es autenticación y no impide llamadas directas a la API.

4. Activa el servicio con `sudo systemctl daemon-reload` y `sudo systemctl enable --now openthink`. Consulta fallos con `sudo journalctl -u openthink -e`.
5. Apunta `api.example.com` al VPS. Configura Nginx para servir la API; por ejemplo, en `/etc/nginx/sites-available/openthink`:

   ```nginx
   server {
       listen 80;
       server_name api.example.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_set_header X-Forwarded-For $remote_addr;
           proxy_buffering off;
           proxy_cache off;
           proxy_read_timeout 300s;
       }
   }
   ```

   Habilita el sitio, comprueba `sudo nginx -t` y recarga Nginx. Obtén un certificado con `sudo certbot --nginx -d api.example.com` y verifica su renovación. Mantén Uvicorn escuchando solo en localhost y abre los puertos 80/443 en el firewall.

   Esta configuración toma la IP de la conexión directa. Si activas el proxy de Cloudflare para el dominio de la API, configura primero el módulo real IP de Nginx con las redes oficiales de Cloudflare; de otro modo todos los usuarios compartirán el límite por IP. Comprueba también los límites de tiempo del proxy para peticiones largas. El frontend en Pages puede utilizar un dominio API con DNS sin proxy.

## Frontend en Cloudflare Pages

Conecta el repositorio a Pages y configura:

- Directorio raíz: `openthink`.
- Comando de compilación: `npm run build`.
- Directorio de salida: `dist`.
- Variable de compilación `VITE_BACKEND_URL`: `https://api.example.com` (sin `/api` ni barra final).
- Node: se fija a la versión 22 mediante `.node-version`.

Añade el dominio real del frontend a `OPENTHINK_CORS_ORIGINS` y reinicia el servicio si cambia. Los dominios de vistas previas de Pages también necesitan figurar explícitamente en CORS; no uses comodines indiscriminados. Cambiar `VITE_BACKEND_URL` requiere recompilar el frontend.

## Comprobación

- `curl https://api.example.com/api/health` debe devolver `{"status":"ok"}`.
- En el sitio publicado, comprueba que la lista de proveedores carga y prueba una clave y un debate real. Confirma que los eventos aparecen progresivamente y que pausar funciona.
- Si falla, revisa la consola de red del navegador, CORS, certificado, DNS y `journalctl -u openthink`. Las pruebas automáticas usan proveedores simulados: no validan modelos, claves ni facturación reales.

Referencias: [configuración de compilación de Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/), [versiones de la imagen de compilación](https://developers.cloudflare.com/pages/configuration/build-image/), [límites de conexión de Cloudflare](https://developers.cloudflare.com/fundamentals/reference/connection-limits/).
