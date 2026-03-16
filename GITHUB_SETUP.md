# GitHub setup rápido

## 1) Inicializa Git

```bash
git init
git add .
git commit -m "Initial commit: Tesseract CEP plugin"
```

## 2) Crea el repositorio en GitHub

Sugerencia de nombre:
- `tesseract-illustrator-plugin`

Puedes dejarlo privado primero y luego abrirlo si quieres.

## 3) Conecta tu repo local con GitHub

Reemplaza `TU-USUARIO` por tu usuario real:

```bash
git remote add origin https://github.com/TU-USUARIO/tesseract-illustrator-plugin.git
git branch -M main
git push -u origin main
```

## 4) Flujo recomendado después

```bash
git add .
git commit -m "Describe el cambio"
git push
```

## 5) Buenas prácticas

- Usa ramas para cambios grandes de UI o motor.
- Etiqueta versiones estables con tags.
- Sube solo código fuente y assets necesarios.
- No subas `.zip`, `.glb`, videos ni exports de prueba.

## 6) Tags sugeridos

```bash
git tag -a v0.9.0-beta -m "Tesseract beta funcional"
git push origin v0.9.0-beta
```

O cuando quieras cerrar una primera release candidate:

```bash
git tag -a v1.0.0-rc1 -m "Release candidate 1"
git push origin v1.0.0-rc1
```
