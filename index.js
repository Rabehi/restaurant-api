/* eslint-disable indent */
const express = require('express')
const app = express()
const pool = require('./app.js')

// Middleware para tratar errores en peticiones
app.use(express.json())
const cors = require('cors')
app.use(cors({
    origin: 'http://localhost:4321', // frontend
    methods: ['PUT', 'GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}))

// MESAS
// get all mesas
app.get('/mesas', async (req, res) => {
    const results = await pool.query('SELECT * FROM mesas')
    res.json(results.rows)
})

// get mesa by id
app.get('mesas/:id', async (req, res) => {
    const id = req.params.id
    const results = await pool.query('SELECT * fom mesas WHERE id = $1', [id])
    res.json(results.rows[0])
})

// update mesa by id
app.put('/mesas/:id', async (req, res) => {
    const id = req.params.id
    const { estado } = req.body // Obtiene el nuevo estado de la solicitud
    const results = await pool.query('UPDATE mesas SET estado = $1 WHERE id = $2 RETURNING * ', [estado, id])
    res.json(results.rows[0])
})

// PRODUCTOS
// get all productos
app.get('/productos', async (req, res) => {
    const results = await pool.query('SELECT * FROM productos')
    res.json(results.rows)
})

// get producto by id
app.get('/productos/:id', async (req, res) => {
    const id = req.params.id
    const results = await pool.query('SELECT * FROM productos WHERE id = $1', [id])
    res.json(results.rows[0])
})

// get producto by categoria
app.get('/productos/:categoria', async (req, res) => {
    const categoria = req.params.categoria
    const results = await pool.query('SELECT * FROM productos WHERE categoria = $1', [categoria])
    res.json(results.rows)
})

// insert producto
app.post('/producto', async (req, res) => {
    const { nombre, precio, categoria, detalles, imagen } = req.body
    const results = await pool.query('INSERT INTO productos (nombre, precio, categoria, detalles, imagen) VALUES ($1, $2, $3, $4, $5) RETURNING *', [nombre, precio, categoria, detalles, imagen])
    res.json(results.rows[0])
})

// update producto
app.put('/producto/:id', async (req, res) => {
    const id = req.params.id
    const { nombre, precio, categoria, detalles, imagen } = req.body // Obtiene el nuevo estado de la solicitud
    const results = await pool.query('UPDATE productos SET nombre = $1, precio = $2, categoria = $3, detalles = $4, imagen = $5 WHERE, id = $6, RETURNING * ', [nombre, precio, categoria, detalles, imagen, id])
    res.json(results.rows[0])
})

// detele producto
app.delete('/producto/:id', async (req, res) => {
    const id = req.params.id
    const results = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id])
    res.json(results.rows[0])
})

// COMANDAS
// post comanda
app.post('/comanda', async (req, res) => {
    const { idMesa, pagado, fecha, totalpagar } = req.body
    const results = await pool.query('INSERT INTO comanda (idmesa, pagado, fecha, totalpagar) VALUES ($1, $2, $3, $4) RETURNING *', [idMesa, pagado, fecha, totalpagar])
    res.json(results.rows[0])
})

// get all comandas
app.get('/comanda', async (req, res) => {
    const results = await pool.query('SELECT * FROM comanda')
    res.json(results.rows)
})

// get comanda by idmesa
app.get('/comanda/:idmesa', async (req, res) => {
    const idmesa = req.params.idmesa
    const results = await pool.query('SELECT * FROM comanda WHERE idmesa = $1', [idmesa])
    res.json(results.rows[0])
})

// get comanda no pagada by idmesa
app.get('/comanda/topay/:idmesa', async (req, res) => {
    const idmesa = req.params.idmesa
    const results = await pool.query('SELECT * FROM comanda WHERE idmesa = $1 and pagado = false', [idmesa])
    res.json(results.rows[0])
})

// update comanda by idmesa
app.put('/comanda/mesa/:idmesa', async (req, res) => {
    const idmesa = req.params.idmesa
    const { pagado, fecha, totalpagar } = req.body // Obtiene el nuevo estado de la solicitud
    const results = await pool.query('UPDATE comanda SET idmesa = $1, pagado = $2, fecha = $3, totalpagar = $4 WHERE, idmesa = $1, RETURNING * ', [idmesa, pagado, fecha, totalpagar])
    res.json(results.rows[0])
})

// update comanda by idcomanda
app.put('/comanda/:id', async (req, res) => {
    const id = req.params.id
    const { idmesa, pagado, fecha, totalpagar } = req.body // Obtiene el nuevo estado de la solicitud
    const results = await pool.query('UPDATE comanda SET idmesa = $2, pagado = $3, fecha = $4, totalpagar = $5 WHERE, id = $1, RETURNING * ', [id, idmesa, pagado, fecha, totalpagar])
    res.json(results.rows[0])
})

// DETALLE_COMANDA
// post detalle_comanda
app.post('/detalle_comanda', async (req, res) => {
    const { idcomanda, idproducto, cantidad, precio } = req.body
    const results = await pool.query('INSERT INTO detalle_comanda (idcomanda, idproducto, cantidad, precio) VALUES ($1, $2, $3, $4) RETURNING *', [idcomanda, idproducto, cantidad, precio])
    res.json(results.rows[0])
})

// get detalle_comanda no pagado by idmesa
app.get('/detalle_comanda/no_pagado/:idmesa', async (req, res) => {
    const idmesa = req.params.idmesa
    const results = await pool.query(`
      SELECT dc.*
      FROM detalle_comanda dc
      INNER JOIN comanda c ON c.id = dc.idcomanda
      WHERE c.pagado = FALSE AND c.idmesa = $1;
    `, [idmesa])
    res.json(results.rows)
})

// update detalle_comanda by iddetallecomanda
app.put('/detalle_comanda/:id', async (req, res) => {
    const id = req.params.id
    const { idcomanda, idproducto, cantidad, precio } = req.body // Obtiene el nuevo estado de la solicitud
    const results = await pool.query('UPDATE detalle_comanda SET idcomanda = $2, idproducto = $3, cantidad = $4, precio = $5 WHERE, id = $1, RETURNING * ', [id, idcomanda, idproducto, cantidad, precio])
    res.json(results.rows[0])
})

const PORT = 3000
app.listen(PORT, () => {
    console.log(`server runing on port ${PORT}`)
})
