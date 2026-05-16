import os

# ==========================================
# CONFIG
# ==========================================

ROOT_FOLDER = "./frontend"   # cambia si quieres
OUTPUT_FILE = "export_prompt.txt"
MAX_LINES = 600

# extensiones permitidas
VALID_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".html",
    ".json",
    ".py",
}

# carpetas ignoradas
IGNORE_FOLDERS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    ".vercel",
    "__pycache__",
}

# ==========================================
# HELPERS
# ==========================================

def should_ignore(path):
    parts = path.split(os.sep)

    for part in parts:
        if part in IGNORE_FOLDERS:
            return True

    return False


def is_valid_file(filename):
    _, ext = os.path.splitext(filename)
    return ext.lower() in VALID_EXTENSIONS


def count_lines(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return len(f.readlines())
    except:
        return 999999


# ==========================================
# MAIN
# ==========================================

exported = []

with open(OUTPUT_FILE, "w", encoding="utf-8") as output:

    output.write(
        "CONVIERTE ESTA APP COMPLETAMENTE A SUPABASE + VERCEL.\n"
    )

    output.write(
        "ELIMINA RENDER, FASTAPI Y SQLITE.\n"
    )

    output.write(
        "USA SOLO REACT + SUPABASE REALTIME.\n\n"
    )

    for root, dirs, files in os.walk(ROOT_FOLDER):

        dirs[:] = [
            d for d in dirs
            if d not in IGNORE_FOLDERS
        ]

        if should_ignore(root):
            continue

        for file in files:

            if not is_valid_file(file):
                continue

            filepath = os.path.join(root, file)

            lines = count_lines(filepath)

            if lines > MAX_LINES:
                continue

            try:

                with open(
                    filepath,
                    "r",
                    encoding="utf-8"
                ) as f:

                    content = f.read()

                relative_path = os.path.relpath(
                    filepath,
                    ROOT_FOLDER
                )

                output.write("\n")
                output.write("=" * 80)
                output.write("\n")

                output.write(
                    f"ARCHIVO: {relative_path}\n"
                )

                output.write(
                    f"LINEAS: {lines}\n"
                )

                output.write("=" * 80)
                output.write("\n\n")

                output.write(content)
                output.write("\n\n")

                exported.append(relative_path)

                print(f"EXPORTADO -> {relative_path}")

            except Exception as e:

                print(
                    f"ERROR -> {filepath} -> {e}"
                )

print("\n")
print("=" * 50)
print("EXPORTACION COMPLETADA")
print("=" * 50)

print(f"\nARCHIVOS EXPORTADOS: {len(exported)}")

print(f"\nARCHIVO GENERADO: {OUTPUT_FILE}")