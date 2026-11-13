use("contentflow");

// 1. AUDITORÍA DE CALIDAD DE DATOS E INCONSISTENCIAS TEMPORALES

// 1.1 Conteo de reacciones con fecha anterior a la creación de su publicación (245)
db.reacciones.aggregate([
  { $lookup: { from: "publicaciones", localField: "publicacion_id", foreignField: "_id", as: "pub" } },
  { $unwind: "$pub" },
  { $match: { $expr: { $lt: [ { $toDate: "$fecha" }, { $toDate: "$pub.fecha_publicacion" } ] } } },
  { $count: "total_reacciones_fecha_invalida" }
]);

// 1.2 Conteo de comentarios con fecha anterior a la creación de su publicación (251)
db.comentarios.aggregate([
  { $lookup: { from: "publicaciones", localField: "publicacion_id", foreignField: "_id", as: "pub" } },
  { $unwind: "$pub" },
  { $match: { $expr: { $lt: [ { $toDate: "$fecha" }, { $toDate: "$pub.fecha_publicacion" } ] } } },
  { $count: "total_comentarios_fecha_invalida" }
]);

// 1.3 Etiquetado auditado de reacciones con inconsistencia temporal (sin borrar historial)
const idsReacInvalidas = db.reacciones.aggregate([
  { $lookup: { from: "publicaciones", localField: "publicacion_id", foreignField: "_id", as: "pub" } },
  { $unwind: "$pub" },
  { $match: { $expr: { $lt: [ { $toDate: "$fecha" }, { $toDate: "$pub.fecha_publicacion" } ] } } },
  { $project: { _id: 1 } }
]).toArray().map(d => d._id);

db.reacciones.updateMany(
  { _id: { $in: idsReacInvalidas } },
  { $set: { inconsistencia_temporal: true, motivo_ie8: "Fecha de reacción anterior a fecha_publicacion" } }
);

// 1.4 Etiquetado auditado de comentarios con inconsistencia temporal (sin borrar historial)
const idsCommInvalidos = db.comentarios.aggregate([
  { $lookup: { from: "publicaciones", localField: "publicacion_id", foreignField: "_id", as: "pub" } },
  { $unwind: "$pub" },
  { $match: { $expr: { $lt: [ { $toDate: "$fecha" }, { $toDate: "$pub.fecha_publicacion" } ] } } },
  { $project: { _id: 1 } }
]).toArray().map(d => d._id);

db.comentarios.updateMany(
  { _id: { $in: idsCommInvalidos } },
  { $set: { inconsistencia_temporal: true, motivo_ie8: "Fecha de comentario anterior a fecha_publicacion" } }
);

// Verificación de documentos etiquetados
db.reacciones.countDocuments({ inconsistencia_temporal: true });
db.comentarios.countDocuments({ inconsistencia_temporal: true });



// 2. TRANSFORMACIÓN Y NORMALIZACIÓN DE FECHAS A TIPO NATIVO ISODate

db.usuarios.updateMany(
  { fecha_registro: { $type: "string" } },
  [{ $set: { fecha_registro: { $toDate: "$fecha_registro" } } }]
);

db.publicaciones.updateMany(
  { fecha_publicacion: { $type: "string" } },
  [{ $set: { fecha_publicacion: { $toDate: "$fecha_publicacion" } } }]
);

db.reacciones.updateMany(
  { fecha: { $type: "string" } },
  [{ $set: { fecha: { $toDate: "$fecha" } } }]
);

db.comentarios.updateMany(
  { fecha: { $type: "string" } },
  [{ $set: { fecha: { $toDate: "$fecha" } } }]
);

db.campanas.updateMany(
  { fecha_inicio: { $type: "string" } },
  [{ $set: { fecha_inicio: { $toDate: "$fecha_inicio" }, fecha_fin: { $toDate: "$fecha_fin" } } }]
);


// 3. ÍNDICES ESTRATÉGICOS Y EVALUACIÓN DE RENDIMIENTO CON EXPLAIN 
db.publicaciones.createIndex({ categoria: 1, fecha_publicacion: -1 });
db.publicaciones.createIndex({ usuario_id: 1 });
db.reacciones.createIndex({ publicacion_id: 1, tipo_reaccion: 1 });
db.comentarios.createIndex({ publicacion_id: 1 });

// Medición de ejecución con índice compuesto (IXSCAN - 1 ms)
db.publicaciones
  .find({ categoria: "Deportes" })
  .sort({ fecha_publicacion: -1 })
  .explain("executionStats");


// 4. CONSULTAS ANALÍTICAS DE NEGOCIO

// 4.1 Top 5 publicaciones con mayor engagement válido
db.publicaciones.aggregate([
  { $lookup: { from: "reacciones", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "reac" } },
  { $lookup: { from: "comentarios", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "comm" } },
  { $project: { _id: 1, categoria: 1, tipo: 1, total_reacciones: { $size: "$reac" }, total_comentarios: { $size: "$comm" }, engagement_total: { $add: [{ $size: "$reac" }, { $size: "$comm" }] } } },
  { $sort: { engagement_total: -1 } },
  { $limit: 5 }
]);

// 4.2 Rendimiento por categoría y tipo de contenido
db.publicaciones.aggregate([
  { $lookup: { from: "reacciones", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "reac" } },
  { $lookup: { from: "comentarios", localField: "_id", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "comm" } },
  { $group: { _id: { categoria: "$categoria", tipo: "$tipo" }, total_publicaciones: { $sum: 1 }, total_reacciones: { $sum: { $size: "$reac" } }, total_comentarios: { $sum: { $size: "$comm" } } } },
  { $sort: { total_reacciones: -1 } }
]);

// 4.3 Distribución de usuarios por país y dispositivo (Top 5)
db.usuarios.aggregate([
  { $group: { _id: { pais: "$pais", dispositivo: "$dispositivo" }, total_usuarios: { $sum: 1 } } },
  { $sort: { total_usuarios: -1 } },
  { $limit: 5 }
]);

// 4.4 Evaluación de cumplimiento de metas en campañas
db.campanas.aggregate([
  { $lookup: { from: "reacciones", localField: "publicaciones_asociadas", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "reac_reales" } },
  { $lookup: { from: "comentarios", localField: "publicaciones_asociadas", foreignField: "publicacion_id", pipeline: [{ $match: { inconsistencia_temporal: { $ne: true } } }], as: "comm_reales" } },
  { $project: { _id: 1, nombre: 1, objetivo: 1, meta_likes: "$metricas_objetivo.likes", reacciones_reales: { $size: "$reac_reales" }, meta_comentarios: "$metricas_objetivo.comentarios", comentarios_reales: { $size: "$comm_reales" } } },
  { $limit: 5 }
]);

// 5. OPERACIONES CRUD DE REGLAS DE NEGOCIO

// 5.1 CREATE (insertOne)
db.publicaciones.insertOne({
  _id: "pub_test_999",
  usuario_id: "user_1",
  contenido: "Lanzamiento oficial del nuevo módulo analítico en ContentFlow.",
  fecha_publicacion: new Date(),
  categoria: "Tecnología",
  hashtags: ["#ContentFlow", "#MongoDB"],
  tipo: "Video"
});

// 5.2 READ (findOne)
db.publicaciones.findOne({ _id: "pub_test_999" });

// 5.3 UPDATE ($push e $inc)
db.campanas.updateOne(
  { _id: "camp_1" },
  { $push: { publicaciones_asociadas: "pub_test_999" } }
);

db.comentarios.updateOne(
  { _id: "comm_1" },
  { $inc: { likes: 15 } }
);

// 5.4 DELETE 
db.campanas.updateOne(
  { _id: "camp_1" },
  { $pull: { publicaciones_asociadas: "pub_test_999" } }
);

db.publicaciones.deleteOne({ _id: "pub_test_999" });