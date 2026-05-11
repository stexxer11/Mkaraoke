# exportar_archivos_especificos.py

import os

ARCHIVOS = [
    "./frontend/src/context/KaraokeContext.jsx",
    "./frontend/src/context/YouTubeContext.jsx",
    "./frontend/src/pages/AdminPage.jsx",
    "./frontend/src/pages/MobilePage.jsx",
    "./frontend/src/pages/TvPage.jsx",
    "./frontend/src/services/youtubeApi.js",
    "./frontend/app.jsx",
    "./frontend/index.jsx",
    "./frontend/main.jsx",
    "./frontend/index.html",
]

SALIDA = "codigo_frontend.txt"

with open(SALIDA, "w", encoding="utf-8") as out:

    for ruta in ARCHIVOS:

        if os.path.exists(ruta):

            with open(ruta, "r", encoding="utf-8") as f:
                contenido = f.read()

            out.write("\n" + "=" * 80 + "\n")
            out.write(f"ARCHIVO: {ruta}\n")
            out.write("=" * 80 + "\n\n")
            out.write(contenido)
            out.write("\n\n")

            print(f"[OK] {ruta}")

        else:
            print(f"[NO EXISTE] {ruta}")

print(f"\nExportado en: {SALIDA}")