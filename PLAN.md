# Plan de trabajo - NASA Space Apps 2026

Reto: Harmonization of MODIS and VIIRS Hot Spots
Equipo: Horum Labs | Sede: Ipiales (virtual) | Hackathon: 14 y 15 de noviembre de 2026

Este documento es el plan unico para los tres. Se sigue por pasos, en orden. Cada paso dice que hacer, quien lo lidera y cuando se considera terminado.

## 0. Reglas que no se pueden olvidar

- Entrega: abre el sabado 14 a las 9:00 a.m. y cierra el domingo 15 a las 11:59 p.m. (hora de Ipiales). Meta interna: enviar antes de las 6:00 p.m. del domingo.
- Demo obligatorio: video de maximo 30 segundos o maximo 7 diapositivas, en un enlace publico sin login. Si el video va en espanol, debe llevar subtitulos en ingles.
- La pagina del proyecto y todo lo enlazado debe estar en ingles.
- Hay que usar al menos un dato NASA y listar TODO lo externo (codigo, librerias, textos, imagenes) en las referencias.
- IA: se puede usar para acelerar el trabajo (codigo, depuracion, redaccion), pero NO para idear como resolver el reto. El enfoque y el metodo de armonizacion lo decidimos nosotros tres. Hay que declarar el uso de IA y dejar notas en el codigo, los datos y las imagenes (marca de agua en imagenes generadas).
- No se usan logos ni simbolos de NASA en contenido generado.
- Los tres deben estar en la misma sede (Ipiales), no estar en lista de espera y aparecer en la pestana Members del equipo.
- Nunca se suben al repositorio: claves (MAP_KEY), contrasenas, correos personales ni datos originales pesados.

## 1. Roles y acuerdos (reunion de 20 minutos)

Roles, que rotan segun haga falta:
- Datos: descarga, limpieza, armonizacion y validacion.
- Web: mapa, calendario, descarga de CSV y publicacion.
- Entrega: pagina del proyecto, demo, referencias, declaracion de IA y revision final.

Acordar:
- [ ] Quien lleva cada rol.
- [ ] Canal de comunicacion y horas de sincronizacion (15 minutos cada 3 o 4 horas).
- [ ] Una rama de Git por rol: data, web, delivery. Commits frecuentes.
- [ ] Region de trabajo: Colombia completa, con un departamento de prueba (por ejemplo Meta o Vichada).
- [ ] Contrato de datos: columnas y formato del archivo que Datos le entrega a Web, con un archivo de ejemplo en la carpeta data/sample.

Terminado cuando: los tres saben su rol y el archivo de ejemplo existe.

## 2. Accesos y herramientas

- [ ] Cada uno tiene cuenta de NASA Earthdata Login (opcional para los demas, obligatoria para quien pida el archivo).
- [ ] MAP_KEY de FIRMS solicitada. Se guarda fuera del repositorio. Limite: 5000 consultas cada 10 minutos.
- [ ] Python con entorno virtual y librerias de datos (pandas, duckdb, pyarrow, geopandas, requests).
- [ ] Proyecto web creado en la rama web.
- [ ] Los tres son colaboradores del repositorio.
- [ ] Todos unidos al grupo de WhatsApp de Ipiales.
- [ ] Archivo REFERENCES.md creado, con FIRMS, MODIS, VIIRS, DANE e IDEAM.

Terminado cuando: Datos puede hacer una consulta de prueba a la API y recibir filas.

## 3. Conseguir los datos de FIRMS

Fuentes (nombres de la API): MODIS_SP, VIIRS_SNPP_SP, VIIRS_NOAA20_SP, VIIRS_NOAA21_SP. Las versiones _NRT son mas recientes y se reemplazan despues.

Cobertura del archivo historico:
- MODIS Collection 6.1: desde el 1 de noviembre de 2000.
- VIIRS S-NPP (375 m): desde el 20 de enero de 2012.
- VIIRS NOAA-20: desde el 1 de abril de 2018.
- VIIRS NOAA-21: desde el 1 de marzo de 2023.

Pasos:
- [ ] Pedir el archivo historico en la pagina Archive Download de FIRMS: area de Colombia (recuadro aproximado oeste -79.5, sur -4.5, este -66.5, norte 12.8), todos los sensores, todas las fechas, formato CSV. Llega por correo.
- [ ] Mientras llega, probar la API por area con 5 dias (la API solo permite de 1 a 5 dias por consulta).
- [ ] Completar los ultimos dias recientes por API cuando el archivo no los cubra.
- [ ] Guardar los originales en data/raw (esta carpeta NO se sube a GitHub) y trabajar sobre copias.
- [ ] Descargar los limites de departamentos y municipios del DANE (Marco Geoestadistico Nacional) para recortar a Colombia.

Terminado cuando: hay archivos de MODIS y VIIRS para Colombia en data/raw y los limites del DANE descargados.

## 4. Conocer los datos

Responder con numeros y graficos simples:
- [ ] Que columnas trae cada sensor y como se expresa la confianza de cada deteccion.
- [ ] Cuantos focos hay por ano y por sensor.
- [ ] Hay huecos de fechas o periodos sin datos.
- [ ] Cuantos puntos caen fuera de Colombia.
- [ ] Que diferencias visibles hay entre MODIS y VIIRS en los anos donde ambos existen.

Terminado cuando: hay un cuaderno o script con estas respuestas, para discutirlas con el equipo.

## 5. Decidir el metodo de armonizacion (los tres juntos)

Esta decision es del equipo. Se toma con lo aprendido en el paso 4 y se escribe en docs/METHOD.md con nuestras propias palabras y el porque de cada eleccion.

Preguntas que hay que resolver:
- [ ] Que filtros de calidad se aplican.
- [ ] A que escala espacial y temporal se agrupan los puntos.
- [ ] Como se hace comparable el conteo entre sensores.
- [ ] Como se trata el periodo en que solo existe MODIS.
- [ ] Como se comunica la incertidumbre.

Terminado cuando: docs/METHOD.md existe, los tres lo leyeron y estan de acuerdo.

## 6. Implementar y validar la armonizacion

- [ ] Script reproducible que regenera todo desde data/raw.
- [ ] Recorte con los limites oficiales del DANE.
- [ ] Archivo final compacto (Parquet o JSON) siguiendo el contrato del paso 1.
- [ ] Validacion: comparar totales por departamento contra los reportes semestrales del IDEAM y anotar donde difieren y por que. Nota: el IDEAM aclara que los focos de calor no son comparables con los registros de campo.
- [ ] Nota en el codigo y los datos sobre que partes se hicieron con ayuda de IA.

Terminado cuando: Web puede leer el archivo final y las cifras tienen sentido frente al IDEAM.

## 7. Web - version minima (MVP)

Esto se construye en paralelo desde el paso 2 con datos de ejemplo.
- [ ] Mapa con herramienta para dibujar el area de interes.
- [ ] Campos de latitud y longitud como alternativa.
- [ ] Selector de rango de fechas.
- [ ] Calendario de actividad con escala de color accesible.
- [ ] Descarga de CSV de lo consultado.
- [ ] Texto corto en la web que explique el metodo.

Terminado cuando: un usuario nuevo puede elegir un area y fechas y ver el calendario sin ayuda.

## 8. Web - funciones del reto

- [ ] Comparar el mes actual contra el historial (mediana) del area elegida.
- [ ] Mostrar que meses y anos tuvieron mas actividad.
- [ ] Marcar dias con actividad inusual para esa zona y epoca.
- [ ] Avisar donde hay pocos datos o huecos.
- [ ] Revisar contraste de colores, uso en celular y velocidad de carga.

Terminado cuando: todo lo anterior funciona con los datos reales.

## 9. Publicar

- [ ] Desplegar la web en un servicio gratuito, con enlace publico y sin login.
- [ ] Probar el enlace en una ventana privada.
- [ ] Pedir la clasificacion de FortiGuard del sitio (recomendado por la guia) para que los jueces puedan abrirlo.
- [ ] README en ingles con: que hace, como correrlo, de donde vienen los datos y como regenerarlos.

Terminado cuando: cualquiera puede abrir el enlace sin cuenta.

## 10. Entrega (Entrega lidera, todos revisan)

En Space Apps: foto de perfil, My Team, pestana Project. Guardar seguido con Save Progress y usar el candado de edicion para no pisarse.

Campos:
- [ ] Project Name.
- [ ] High-Level Summary (en ingles).
- [ ] Link to Project Demo: video de 30 segundos o 7 diapositivas, enlace publico.
- [ ] Link to Final Project: la web publicada.
- [ ] Detailed Description (en ingles): que hace, como funciona, beneficios, herramientas.
- [ ] Use of Super Intelligence (SI): como se uso la IA.
- [ ] NASA Data: FIRMS (MODIS y VIIRS), con detalle.
- [ ] Space Agency Partner Data and Other References: todo lo externo, incluido el codigo abierto y los datos de DANE e IDEAM.
- [ ] Marcar los dos recuadros de aceptacion.
- [ ] Pulsar Submit (no basta con Save Progress).

## 11. Revision final antes de enviar

- [ ] Los enlaces del demo y del proyecto abren en ventana privada.
- [ ] Todo el texto esta en ingles.
- [ ] El video tiene subtitulos en ingles si esta en espanol.
- [ ] Las referencias estan completas.
- [ ] La declaracion de IA esta completa y hay marcas en imagenes, codigo y datos.
- [ ] Los tres aparecen en Members y ninguno esta en lista de espera.
- [ ] Se envio antes de las 6:00 p.m. del domingo.

## 12. Plan B si algo falla

- El correo con los datos no llega: avanzar con la API sobre un periodo corto y ampliar despues.
- La armonizacion se complica: entregar una version simple, bien explicada y con sus limites claros.
- Falta tiempo: el minimo es mapa, calendario y CSV. Todo lo demas es extra.
- El enlace de la web falla: dejar el repositorio con instrucciones de ejecucion y un video del funcionamiento.

## 13. Linea de tiempo

Sabado 14:
- Manana: pasos 1, 2 y 3. Se pide el archivo de FIRMS. Web arranca con datos de ejemplo.
- Tarde: pasos 4 y 5. Web avanza el calendario.
- Noche: primer calendario con datos reales, de extremo a extremo.

Domingo 15:
- Manana: pasos 6 y 8. Validacion, comparacion con el historial, CSV.
- Mediodia: congelar funciones nuevas. Solo corregir errores. Paso 9.
- Tarde: pasos 10 y 11. Demo, textos y envio antes de las 6:00 p.m.
