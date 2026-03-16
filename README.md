# Tesseract

CEP plugin para Adobe Illustrator enfocado en prototipos de packaging: extracción de dielines, preview 3D, plegado interactivo y exportación a GLB.

**Tagline:** Fold engine for packaging prototypes  
**Iterated by:** [tatto_posada](https://www.linkedin.com/in/gerardocalambasp/)

## Status

Versión funcional / release candidate orientada a:
- validación interna
- iteración de UX
- pruebas de export GLB
- prototipado de empaques

---

## Qué hace

- Lee capas de troquel y pliegue desde Illustrator.
- Genera un preview 2D del dieline.
- Construye un modelo 3D con espesor configurable.
- Permite elegir panel base y seleccionar creases para plegado.
- Aplica arte de **Front / Back** o **Tiro / Retiro**.
- Exporta el estado actual del visor 3D a **GLB**.

## Convenciones esperadas en Illustrator

### Geometría
- `Cuts`
- `Creases`

### Arte
Se soportan dos convenciones:
- `Front` / `Back`
- `Tiro` / `Retiro`

Pueden venir como **capas** o como **artboards** nombrados con esa misma convención.

## Flujo de uso

1. Abrir el panel en Illustrator.
2. `Test Connection`
3. `Extract Dieline`
4. Revisar el bloque de importación.
5. `Continue to 3D`
6. En el visor 3D:
   - **Shift + click** sobre un panel para definir la base.
   - **Alt/Option + click** sobre una línea roja para seleccionar un crease.
7. Ajustar espesor y stock en `Material`.
8. Refrescar arte en `Artwork` cuando sea necesario.
9. Plegar desde `Creases`.
10. `Export GLB` para sacar exactamente el estado actual del visor.

## Materiales disponibles

- White
- Kraft
- Gray

Estos presets afectan principalmente:
- cantos
- caras internas del espesor
- material auxiliar del pliegue

## Export GLB

El export funciona bajo la regla **what you see is what you export**:
- se exporta la postura actual del visor
- con el pliegue actual
- con el arte aplicado
- con el espesor actual
- sin variantes múltiples ni estado flat adicional

## Estructura del proyecto

```text
CSXS/
  manifest.xml
icons/
  icon_dark.png
  icon_dark@2x.png
  icon_normal.png
  icon_normal@2x.png
libs/
  OrbitControls.js
  three.min.js
docs/
  TECH_BRIEF_V1.md
index.html
main.js
style.css
linkedin_logo.svg
tesseract_icon.svg
tesseract_logo.svg
README.md
.gitignore
```

## Instalación local

Este repositorio está pensado para correr como extensión **CEP** de Illustrator.

Instalación típica de desarrollo:
1. Clona o descarga este repo.
2. Copia la carpeta completa del proyecto a tu carpeta de extensiones CEP.
3. Abre Illustrator.
4. Carga el panel desde el menú de extensiones correspondiente a tu instalación.

> Nota: en entornos de desarrollo CEP puede ser necesario permitir extensiones no firmadas según tu configuración local de Adobe.

## Estado

Versión funcional / release candidate orientada a:
- validación interna
- iteración de UX
- pruebas de export GLB
- prototipado de empaques

## Recomendaciones para el repo

No subir al repositorio:
- builds `.zip`
- exports `.glb` o archivos de prueba pesados
- capturas, videos y logs temporales
- archivos de sistema como `.DS_Store`

## Créditos

- Concepto y dirección de producto: Gerardo Calambas / tatto_posada
- Desarrollo iterativo del plugin: Tesseract working build
