# Despliegue: ia-roadmap en GitHub Pages + Supabase

Este documento cubre el proceso completo para publicar el proyecto usando GitHub Pages como hosting y Supabase como base de datos.

---

## Paso 1 — Crear el proyecto en Supabase (5 min)

1. Ir a [supabase.com](https://supabase.com) → **Start your project** → crear cuenta con GitHub.
2. **New project** → nombre: `ia-roadmap` → elegir región (`us-east-1` está bien) → crear contraseña.
3. Esperar ~2 min a que el proyecto inicialice.

---

## Paso 2 — Crear la tabla (1 min)

En el panel de Supabase → **SQL Editor** → ejecutar:

```sql
create table user_data (
  key   text primary key,
  value jsonb not null default '{}'
);
```

---

## Paso 3 — Obtener las credenciales

En Supabase → **Project Settings** → **API**:

- Copiar **Project URL** → reemplazar `REPLACE_WITH_YOUR_SUPABASE_URL` en `app.js` (línea ~44).
- Copiar **anon / public key** → reemplazar `REPLACE_WITH_YOUR_SUPABASE_ANON_KEY` en `app.js` (línea ~45).

> La `anon key` de Supabase es segura para exponer en el frontend; está diseñada específicamente para ese uso.

---

## Paso 4 — Subir a GitHub Pages

```bash
git init
git add .
git commit -m "Deploy ia-roadmap"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/ia-roadmap.git
git push -u origin main
```

Luego en GitHub → **Settings** → **Pages** → Source: **Deploy from branch** → rama `main` → carpeta `/root` → **Save**.

URL final: `https://TU_USUARIO.github.io/ia-roadmap/`

---

## Notas

- El servidor local (`npm start`) sigue funcionando para desarrollo; Supabase se usa en ambos entornos (local y producción).
- El progreso queda sincronizado entre dispositivos (laptop, celular, etc.) gracias a Supabase.
- `data/progress.json` y `data/custom.json` ya no se usan en producción; el dato real vive en Supabase.
