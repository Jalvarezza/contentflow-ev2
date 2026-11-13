# Evaluación Parcial 2
**Asignatura:** Bases de Datos No Relacionales  
**Tecnologías:** MongoDB Atlas, MongoDB Compass (`mongosh`), Node.js, Express, Postman / Thunder Client.

## Estructura del Repositorio: 

* `/scripts-mongodb/`: Scripts ejecutados en MongoDB Shell (`mongosh`) para auditoría de calidad, normalización de tipos de fecha, creación de índices compuestos y pruebas de rendimiento `explain()`, consultas analíticas de negocio y ciclo CRUD completo.

* `/api-contentflow/`: Servicio backend REST construido con Node.js y Express conectado a MongoDB Atlas mediante el driver oficial `mongodb`.

* `/postman/`: Colección JSON exportable con los 5 endpoints probados (`GET`, `POST`, `PATCH`, `DELETE`).

* `/Capturas/`: Evidencias visuales organizadas cronológicamente desde la Fase 1 hasta la Fase 5.


## Instrucciones de Ejecución de la API

1. **Clonar el repositorio e ingresar a la carpeta de la API:**
   ```bash
   git clone https://github.com/Jalvarezza/contentflow-ev2.git
   cd contentflow-ev2/api-contentflow