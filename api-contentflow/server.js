const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

//credenciales para conectar con mongodb
const uri = process.env.MONGO_URI || "mongodb+srv://<USUARIO>:<PASSWORD>@<CLUSTER>.mongodb.net/?retryWrites=true&w=majority";
let db;

async function conectarDB() {
  await client.connect();
  db = client.db("contentflow");
  console.log("[LOG API] Conectado exitosamente a MongoDB Atlas -> Base de datos: contentflow");
}

// 1. GET: Listar publicaciones filtradas por categoría
app.get('/api/publicaciones', async (req, res) => {
  try {
    const filtro = req.query.categoria ? { categoria: req.query.categoria } : {};
    const datos = await db.collection('publicaciones').find(filtro).limit(10).toArray();
    console.log(`[GET /api/publicaciones] Filtro: ${JSON.stringify(filtro)} -> ${datos.length} registros`);
    res.status(200).json({ ok: true, total: datos.length, datos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. GET: Analítica Top 5 publicaciones con mayor engagement
app.get('/api/analitica/top-engagement', async (req, res) => {
  try {
    const top = await db.collection('publicaciones').aggregate([
      { $lookup: { from: "reacciones", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "reac" } },
      { $lookup: { from: "comentarios", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "comm" } },
      { $project: { _id: 1, categoria: 1, tipo: 1, total_reacciones: { $size: "$reac" }, total_comentarios: { $size: "$comm" }, engagement_total: { $add: [{ $size: "$reac" }, { $size: "$comm" }] } } },
      { $sort: { engagement_total: -1 } },
      { $limit: 5 }
    ]).toArray();
    console.log(`[GET /api/analitica/top-engagement] Top 5 calculado correctamente`);
    res.status(200).json({ ok: true, top });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. POST: Crear una nueva publicación
app.post('/api/publicaciones', async (req, res) => {
  try {
    const nuevaPub = {
      ...req.body,
      fecha_publicacion: new Date()
    };
    const resultado = await db.collection('publicaciones').insertOne(nuevaPub);
    console.log(`[POST /api/publicaciones] Publicación creada con ID: ${resultado.insertedId}`);
    res.status(201).json({ ok: true, mensaje: "Publicación creada", insertedId: resultado.insertedId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 4. PATCH: Incrementar likes de un comentario ($inc)
app.patch('/api/comentarios/:id/like', async (req, res) => {
  try {
    const resultado = await db.collection('comentarios').updateOne(
      { _id: req.params.id },
      { $inc: { likes: 1 } }
    );
    console.log(`[PATCH /api/comentarios/${req.params.id}/like] Modificados: ${resultado.modifiedCount}`);
    res.status(200).json({ ok: true, modifiedCount: resultado.modifiedCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. DELETE: Eliminar una publicación por ID
app.delete('/api/publicaciones/:id', async (req, res) => {
  try {
    const resultado = await db.collection('publicaciones').deleteOne({ _id: req.params.id });
    console.log(`[DELETE /api/publicaciones/${req.params.id}] Eliminados: ${resultado.deletedCount}`);
    res.status(200).json({ ok: true, deletedCount: resultado.deletedCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

conectarDB().then(() => {
  app.listen(3000, () => {
    console.log("[LOG API] Servidor ContentFlow corriendo en http://localhost:3000");
  });
}).catch(err => console.error("Error conectando a Atlas:", err));