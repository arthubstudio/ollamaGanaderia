# 🐄 Ganaderia_AI

Sistema inteligente para la gestión de ganado bovino con Inteligencia Artificial local.

---

# 📌 Descripción

Ganaderia_AI es una plataforma desarrollada para ayudar a ranchos, ganaderos y administradores pecuarios a controlar toda la información de su ganado desde un único sistema.

Permite registrar vacas, propietarios, ranchos, vacunas, enfermedades, pesos y movimientos de propiedad, además de incorporar Inteligencia Artificial para realizar consultas inteligentes sobre la información almacenada.

---

# 🚨 Problemática

Actualmente muchos ranchos gestionan su información mediante:

* Libretas físicas.
* Hojas de cálculo.
* Mensajes de WhatsApp.
* Registros dispersos.

Esto genera:

* Pérdida de información.
* Historiales incompletos.
* Dificultad para rastrear vacunas.
* Problemas de seguimiento sanitario.
* Falta de control sobre propietarios y ranchos.
* Información difícil de consultar.

---

# ✅ Solución

Ganaderia_AI centraliza toda la información ganadera en una única plataforma.

Características:

* Registro de vacas.
* Administración de dueños.
* Administración de ranchos.
* Control de pesos.
* Control sanitario.
* Registro de enfermedades.
* Historial de propiedad.
* Ventas de ganado.
* IA local con Ollama.
* Búsqueda semántica mediante pgvector.

---

# 🛠 Tecnologías Utilizadas

## Frontend

* Nuxt 3
* Vue 3
* TailwindCSS

## Backend

* Nitro Server
* Drizzle ORM
* PostgreSQL

## Inteligencia Artificial

* Ollama
* Llama 3
* Nomic Embed Text
* pgvector

## Infraestructura

* Docker
* Docker Compose

---

# 📦 Requisitos

Instalar previamente:

* Node.js 20+
* Docker
* Docker Compose
* Git

---

# 🚀 Clonar Proyecto

```bash
git clone https://github.com/arthubstudio/ollamaGanaderia.git

cd Ganaderia_AI/app
```

---

# 📥 Instalar Dependencias

Con pnpm:

```bash
pnpm install
```

---

# 🐳 Levantar Base de Datos

Iniciar PostgreSQL con Docker:

```bash
docker compose up -d
```

Verificar contenedores:

```bash
docker ps
```

---

# 🗄 Entrar a PostgreSQL

```bash
docker exec -it ganaderia_db psql -U ganaderia -d ganaderia_ai
```

---

# 📊 Consultas Útiles

Mostrar tablas:

```sql
\dt
```

Ver vacas:

```sql
SELECT * FROM vacas;
```

Ver propietarios:

```sql
SELECT * FROM duenos;
```

Ver vacunas:

```sql
SELECT * FROM vacunas;
```

Ver pesos:

```sql
SELECT * FROM pesos;
```

---

# 🌱 Cargar Datos Iniciales

Ejecutar seed:

```bash
docker exec -i ganaderia_db psql -U ganaderia -d ganaderia_ai < database/seeds.sql
```

---

# ▶ Ejecutar Proyecto

Modo desarrollo:

```bash
pnpm dev
```

Abrir:

```text
http://localhost:3000
```

---

# 📋 Funcionalidades

## Gestión de Vacas

* Crear
* Editar
* Eliminar
* Historial

## Gestión de Dueños

* Crear
* Editar
* Eliminar

## Gestión de Ranchos

* Crear
* Editar
* Eliminar

## Gestión de Vacunas

* Catálogo de vacunas
* Aplicación de vacunas
* Historial sanitario

## Gestión de Enfermedades

* Registro
* Tratamientos
* Seguimiento veterinario

## Gestión de Pesos

* Registro histórico
* Seguimiento de crecimiento

## Gestión de Ventas

* Historial de ventas
* Seguimiento comercial

## Inteligencia Artificial

Consultas como:

```text
¿Qué vacas Angus tengo?

¿Cuánto pesa Lola?

¿Qué vacunas tiene aplicadas ToroMax?

¿Qué animales están listos para venta?

¿Qué enfermedades ha tenido esta vaca?
```

---

# 🐳 Comandos Docker

Detener contenedores:

```bash
docker compose down
```

Reiniciar:

```bash
docker compose restart
```

Ver logs:

```bash
docker compose logs -f
```

Eliminar volúmenes y reconstruir:

```bash
docker compose down -v

docker compose up -d
```

---

# 🎓 Proyecto Académico

Proyecto desarrollado como parte de la carrera:

**Ingeniería en Desarrollo y Gestión de Software**

**Universidad Tecnológica Metropolitana (UTM)**

---

# 👨‍💻 Autor

**Hugo Arcos Zuñiga**

Desarrollador Full Stack | Inteligencia Artificial | Sistemas Ganaderos
