# AutoQueuer

**Idioma:** [English](README.md) | Español

> Automatiza la cola de Spotify creando reglas personalizadas para agregar una canción después de otra.

**AutoQueuer** es una app para **Spicetify** que elimina la necesidad de agregar canciones manualmente a la cola cuando quieres que una canción siempre sea seguida por otra.

Es especialmente útil para álbumes o canciones con transiciones, donde el orden de reproducción marca la diferencia. También permite añadir un porcentaje de probabilidad para que las reglas no siempre se ejecuten, creando un factor sorpresa durante la reproducción.

---

## Capturas de pantalla

![alt text](</autoqueuer/src/images/Ss_base.png>)
![alt text](</autoqueuer/src/images/Ss_rules.png>)
![alt text](</autoqueuer/src/images/Ss_editing.png>)

---

## ¿Por qué AutoQueuer?

Spotify permite agregar canciones manualmente a la cola, pero no automatizar ese proceso.

Con AutoQueuer puedes crear reglas como:

> **Cuando se reproduzca:** Canción A
> **Agregar en la fila:** Canción B

Cada vez que se reproduzca la primera canción, la segunda se agregará automáticamente a la fila.

Además, puedes decidir si la transición debe ocurrir siempre o solamente con una probabilidad configurable.

---

## Características

* Agrega automáticamente una canción después de otra.
* Probabilidad configurable del **1% al 99%**.
* Evita agregar la misma canción más de una vez si reinicias o retrocedes la reproducción.
* Agrega la siguiente canción cuando la actual alcanza aproximadamente el **70%** de reproducción.
* Permite crear, editar, pausar, activar, desactivar y eliminar reglas.
* Integración completa con Spotify mediante Spicetify.

---

## Instalación

### Requisitos

* Spicetify
* Spotify
* Conexión a internet para buscar canciones

### macOS / Linux

Ejecuta el siguiente comando:

```bash
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/install.sh | sh
```

### Marketplace de Spicetify

Con un poco de suerte, AutoQueuer estará disponible próximamente en el Marketplace de Spicetify para instalarse con un solo clic.

---

## Cómo usarlo

1. Abre Spotify.
2. Abre **AutoQueuer** desde la barra superior.
3. Busca la canción que activará la regla.
4. Selecciónala en **Cuando se reproduzca**.
5. Busca la canción que quieres agregar automáticamente.
6. Selecciónala en **Agregar en la fila**.
7. Opcionalmente configura una probabilidad.
8. Guarda la regla.

A partir de ese momento, AutoQueuer administrará la cola automáticamente cuando se cumplan las condiciones.

---

## Cómo funciona

Cada regla permanece activa hasta que la desactives.

Cuando una canción alcanza aproximadamente el **70%** de reproducción, AutoQueuer verifica:

* Que exista una regla para esa canción.
* Que la regla esté activa.
* Que la probabilidad (si existe) se cumpla.
* Que la canción destino no haya sido agregada previamente durante esa reproducción.

Si todas las condiciones se cumplen, la canción destino se agrega automáticamente a la cola.

---

## Limitaciones actuales

* Solo admite reglas de **una canción → una canción**.
* No funciona con canciones locales.
* Requiere conexión a internet para buscar canciones.
* Actualmente las instrucciones de instalación solo están disponibles para macOS y Linux.

---

## Roadmap

* [ ] Historial de reglas ejecutadas
* [ ] Historial de probabilidades
* [ ] Barra visual de probabilidad
* [ ] Botón para volver a calcular la probabilidad (*reroll*)
* [ ] Varias canciones destino por regla
* [ ] Más opciones de automatización

---

## Preguntas frecuentes

### ¿Necesito configurar algo después de instalar la aplicación?

No. Solo abre AutoQueuer y comienza a crear reglas.

### ¿Funciona con canciones locales?

Todavía no.

### ¿Funciona en Windows?

La aplicación debería funcionar en cualquier sistema compatible con Spicetify, aunque por ahora solo hay instrucciones de instalación para macOS y Linux.

---

## Contribuciones

Los reportes de errores, sugerencias y contribuciones son siempre bienvenidos.

Si encuentras un problema o tienes una idea para mejorar AutoQueuer, no dudes en abrir un Issue.

---

## Agradecimientos

* Al equipo de **Spicetify** por crear el framework que hace posible este proyecto.
* A todas las personas que prueben AutoQueuer y compartan sus comentarios.
* Un agradecimiento especial a **Jordan**, mi pequeño chihuahua, por acompañarme durante incontables horas de desarrollo.

---

## Licencia

Licencia MIT
