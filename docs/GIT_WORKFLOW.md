# Flujo de trabajo con Git - Horum Labs

Proyecto: NASA Space Apps 2026 - Harmonization of MODIS and VIIRS Hot Spots

Este documento define cómo usamos las ramas para no pisarnos y para que `main` siempre funcione.

## 1. Punto de partida

El esqueleto del proyecto se sube primero a `main`. Es la base de la que salen todas las ramas.

Antes de ese primer commit, revisar que:

- [ ] El `.gitignore` excluye `.env` y `data/raw/`.
- [ ] No hay claves (MAP_KEY), contraseñas ni correos personales en ningún archivo.
- [ ] No se están subiendo datos originales pesados.

```bash
git add -A && git commit -m "Project structure"
git push origin main
```

## 2. Ramas

`main` debe estar siempre en un estado que funcione, porque de ahí se publica la web. Cada persona trabaja en una rama larga según su rol.

| Rama | Rol | Qué toca |
|---|---|---|
| `main` | Todos (solo por integración) | Versión estable |
| `data` | Datos | `scripts/`, `notebooks/`, `data/sample/`, `docs/METHOD.md` |
| `web` | Web | Carpeta de la web y sus archivos |
| `delivery` | Entrega | `README.md`, `REFERENCES.md`, `docs/`, guion del demo |

Regla para no pisarse: cada rama toca carpetas distintas. Los archivos compartidos (`README.md`, `requirements.txt`) los edita una sola persona o se avisa antes.

Crear tu rama desde `main` (cambia `data` por `web` o `delivery`):

```bash
git checkout main && git pull && git checkout -b data
```

## 3. Flujo diario

1. Traer los cambios de `main` a tu rama antes de empezar:

   ```bash
   git pull origin main
   ```

2. Trabajar en tu rama con commits pequeños y frecuentes, con mensajes claros.
3. Subir tu rama seguido, para no perder trabajo:

   ```bash
   git push origin data
   ```

4. Integrar a `main` cuando algo ya funcione, con un pull request en GitHub. Otra persona del equipo lo revisa y lo aprueba. Hacerlo varias veces al día, no al final.

## 4. Momentos de integración

| Momento | Qué se integra |
|---|---|
| Archivo final de datos listo | `data` a `main`. Web conecta el calendario a datos reales |
| Sábado, noche | Primer calendario de extremo a extremo en `main` |
| Domingo, mediodía | Se congelan las funciones nuevas. Solo se aceptan correcciones de errores |
| Domingo, tarde | La versión publicada sale de `main` |

Al entregar, marcar la versión para recordar qué se envió:

```bash
git tag delivery-final
git push origin delivery-final
```

## 5. Reglas del equipo

- Nadie hace `git push --force` a `main`.
- Después del primer commit, no se trabaja directo en `main`, salvo cambios mínimos acordados.
- Si hay un conflicto, lo resuelve quien integra, con la otra persona al lado.
- Datos pesados y claves nunca se suben. La MAP_KEY va en una variable de entorno o en `.env`.
- Cada quien anota en `REFERENCES.md` qué partes hizo con ayuda de IA.

## 6. Mensajes de commit

Cortos y en presente, con el área al inicio:

```text
data: add FIRMS API fetch script with cache
web: add map with area selection
delivery: draft project summary in English
```

## 7. Si algo sale mal

- Subí algo que no debía (clave o dato pesado): avisar al equipo de inmediato. Cambiar la clave y borrarla del historial, no solo del último commit.
- Conflicto que no se resuelve: no forzar. Guardar el trabajo en otra rama y pedir ayuda.
- Rama atrasada respecto a `main`: traer `main` y resolver antes de seguir.

```bash
git pull origin main
```

## 8. Opcional: proteger main

En GitHub, en Settings, Branches, se puede exigir un pull request antes de modificar `main`. Con tres personas y poco tiempo puede ser demasiado, así que es opcional.
