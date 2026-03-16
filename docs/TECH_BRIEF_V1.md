# Tesseract — Brief técnico maestro v1

## Objetivo
Construir un panel CEP para Illustrator que permita:
- leer un troquel desde capas de corte y pliegue,
- convertirlo en un sólido 3D con espesor configurable,
- mantenerlo acostado sobre el suelo,
- seleccionar un panel base fijo,
- plegar por líneas de crease con control angular,
- y preparar la base para proyectar arte Front/Back o Tiro/Retiro.

## Alcance aprobado
### Entrada geométrica
- Capa `Cuts` o variantes detectables (`cut`, `corte`, `troquel`, `die`, etc.).
- Capa `Creases` o variantes detectables (`crease`, `fold`, `pliegue`, `doblez`, etc.).

### Entrada de arte
Se aceptarán dos convenciones equivalentes:
- `Front` / `Back`
- `Tiro` / `Retiro`

Y podrán venir como:
- artboards nombrados, o
- capas nombradas.

## Regla maestra de proyección
Toda proyección de arte debe calcularse contra el rectángulo completo del artboard, no contra el bounding box del troquel.

## Alcance fuera de v1
- corrugado,
- materiales PBR,
- físicas avanzadas,
- colisiones complejas,
- simulación industrial,
- troqueles extremadamente atípicos.

## Arquitectura funcional
1. **Extracción**
   - Illustrator entrega geometría 2D desde `Cuts` y `Creases`.
2. **Topología**
   - Se construye un grafo planar para detectar caras/paneles.
3. **Módulos**
   - Cada cara cerrada se convierte en un panel extruido.
4. **Bisagras**
   - Cada crease compartido entre dos paneles funciona como eje de pliegue.
5. **Base fija**
   - Un panel puede fijarse como `package bottom`.
6. **Plegado jerárquico**
   - Los paneles hijos se mueven por árbol de adyacencia.
7. **Arte**
   - Front/Back o Tiro/Retiro se rasteriza desde Illustrator con marco de artboard.
8. **Exportación**
   - PNG 3D inmediato.
   - GLB en fase posterior de export.

## Fases de trabajo
### Fase 1 — Base visual y geométrica
- sólido opaco,
- espesor default 2 mm,
- color `#4C4C4C`,
- líneas de crease rojas visibles,
- sólido apoyado en el suelo.

### Fase 2 — Arte exterior/interior
- artboards o capas con naming aprobado,
- rasterización interna,
- proyección en coordenadas de artboard.

### Fase 3 — Modularización
- división en paneles,
- detección de bisagras compartidas.

### Fase 4 — Base panel
- elección manual de cara base,
- idealmente por click directo en el visor.

### Fase 5 — Plegado
- control por ángulo,
- sliders por crease,
- reset flat.

### Fase 6 — Propagación estructural
- plegado jerárquico a través del árbol de adyacencia.

### Fase 7 — Export final
- PNG,
- GLB,
- validaciones de entrada.

## Criterios de aceptación iniciales
- El sólido debe verse acostado, no vertical.
- El espesor por defecto debe ser 2.0 mm.
- El usuario debe poder cambiar el espesor y reconstruir.
- Las líneas de crease deben seguir visibles por encima del sólido.
- El usuario debe poder definir el panel base desde UI y por click sobre el panel.

## Estado del código en esta iteración
Implementado en esta entrega:
- fase 1 visual,
- selector de espesor con rebuild,
- base panel por dropdown y click en el visor,
- highlight visual del panel base,
- reorganización del build 3D para que la orientación base quede sobre el suelo.

Pendiente para la siguiente iteración:
- raster de Front/Back o Tiro/Retiro,
- UV/proyección por artboard,
- export GLB.
