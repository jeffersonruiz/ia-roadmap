# IA Expert Roadmap — Tracker local

Aplicación web local para seguir tu progreso en la ruta IA Expert de 12 meses.  
**Requiere Node.js** (cualquier versión ≥ 14). Sin dependencias externas.

## Cómo correr la aplicación

```bash
# 1. Entra a la carpeta
cd ia-roadmap

# 2. Inicia el servidor
npm start
# o también: node server.js

# 3. Abre en tu navegador
# http://localhost:3000
```

¡Listo! No necesitas instalar nada extra — usa solo módulos nativos de Node.

## Estructura
```
ia-roadmap/
├── index.html          ← Aplicación principal
├── data/
│   ├── roadmap.json    ← Datos de la ruta (fases, pasos, cursos)
│   └── progress.json   ← Plantilla de progreso (tu avance se guarda en el navegador)
└── README.md
```

## Cómo funciona el guardado
Tu progreso (pasos completados, cursos hechos, notas) se guarda automáticamente en el **localStorage** del navegador. Funciona sin internet y sin base de datos.

> Si limpias el localStorage del navegador, perderás el progreso. Para hacer backup, abre la consola del navegador y ejecuta:
> ```js
> copy(localStorage.getItem('ia_roadmap_progress'))
> ```
> y pega el resultado en un archivo de texto.

## Personalizar la ruta
Puedes editar `data/roadmap.json` para agregar, quitar o modificar pasos y cursos. La aplicación se actualiza automáticamente al recargar.
