/* eslint-disable indent */
const express = require('express')
const app = express()
const pool = require('./app.js')

const http = require('http')
const WebSocket = require('ws')
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

// Middleware para tratar errores en peticiones
app.use(express.json())
const cors = require('cors')
app.use(cors({
    origin: 'http://localhost:4321', // frontend
    methods: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type']
}))

// WebSocket: Manejar conexiones
wss.on('connection', (ws, req) => {
    console.log('Cliente conectado')

    // Verificar el origen de la conexión
    const origin = req.headers.origin
    if (origin !== 'http://localhost:4321') {
        console.log('Conexión rechazada: origen no permitido')
        ws.close()
        return
    }

    ws.on('message', (message) => {
        console.log(`Mensaje recibido: ${message}`)

        // Convertir el mensaje a JSON (si no lo está)
        let jsonMessage
        try {
            // Si el mensaje es un Blob, convertirlo a texto
            if (message instanceof Buffer || message instanceof ArrayBuffer) {
                const decoder = new TextDecoder('utf-8')
                jsonMessage = JSON.parse(decoder.decode(message))
            } else {
                // Si el mensaje es texto, parsearlo como JSON
                jsonMessage = JSON.parse(message)
            }
        } catch (error) {
            console.error('Error al parsear el mensaje:', error)
            return
        }

        // Enviar el mensaje como JSON a todos los clientes
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(jsonMessage))
            }
        })
    })

    ws.on('close', () => {
        console.log('Cliente desconectado')
    })
})

/**
 * @route GET /mesas
 * @desc Obtiene todas las mesas ordenadas:
 *       1. Mesas con estado diferente de 0 y 1 (ordenadas por updated_at ASC)
 *       2. Mesas con estado 1 (ordenadas por updated_at ASC)
 *       3. Mesas con estado 0 (ordenadas por updated_at ASC)
 */
app.get('/mesas', async (req, res) => {
    try {
        const results = await pool.query(`
            SELECT * 
            FROM mesas 
            ORDER BY 
                CASE 
                    WHEN estado NOT IN (0, 1) THEN 0
                    WHEN estado = 1 THEN 1
                    WHEN estado = 0 THEN 2
                END,
                updated_at ASC
        `)
        res.json(results.rows)
    } catch (error) {
        console.error('Error al obtener mesas:', error)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
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

    // Notificar a todos los clientes sobre la actualización
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'updateMesa', id: parseInt(id), estado }))
            console.log(`Notificando a los clientes: Mesa ${id} actualizada a estado ${estado}`)
        }
    })

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
    const { idMesa, pagado, fecha, totalpagar, idusuario } = req.body
    const results = await pool.query('INSERT INTO comanda (idmesa, pagado, fecha, totalpagar, idusuario) VALUES ($1, $2, $3, $4, $5) RETURNING *', [idMesa, pagado, fecha, totalpagar, idusuario])
    // Notificar a todos los clientes sobre la nueva comanda
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'updateComanda',
                mesaId: idMesa
            }))
        }
    })
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

// update comanda to pagada by idmesa
app.put('/comanda/marcar-pagadas/:idmesa', async (req, res) => {
    const idmesa = req.params.idmesa
    try {
        const results = await pool.query(
            'UPDATE comanda SET pagado = true WHERE idmesa = $1 RETURNING *',
            [idmesa]
        )
        if (results.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron comandas para esta mesa'
            })
        }
        res.json({
            success: true,
            comanda: results.rows[0]
        })
    } catch (error) {
        console.error('Error en marcar-pagadas:', error)
        res.status(500).json({
            success: false,
            error: 'Error al marcar comandas como pagadas'
        })
    }
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
      SELECT dc.*, p.nombre AS producto_nombre
        FROM detalle_comanda dc
        INNER JOIN comanda c ON c.id = dc.idcomanda
        INNER JOIN productos p ON p.id = dc.idproducto
        WHERE c.pagado = FALSE AND c.idmesa = $1
        ORDER BY dc.idcomanda ASC;
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

// get comanda historico by idusuario
app.get('/comanda/historico/:idusuario', async (req, res) => {
    const idusuario = req.params.idusuario

    try {
        const result = await pool.query(`
            SELECT 
                c.fecha,
                p.nombre AS producto,
                dc.cantidad
            FROM comanda c
            INNER JOIN detalle_comanda dc ON c.id = dc.idcomanda
            INNER JOIN productos p ON p.id = dc.idproducto
            WHERE c.idusuario = $1
            ORDER BY c.fecha DESC, c.id;
        `, [idusuario])

        res.json(result.rows)
    } catch (err) {
        console.error('Error al obtener el histórico:', err)
        res.status(500).json({ error: 'Error al obtener el histórico' })
    }
})

// Endpoint para registrar usuarios
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body

    try {
        // Verificar si el usuario ya existe
        const userExists = await pool.query(
            'SELECT * FROM usuario WHERE email = $1',
            [email]
        )

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' })
        }

        // Insertar nuevo usuario (contraseña en texto plano)
        const newUser = await pool.query(
            'INSERT INTO usuario (email, password) VALUES ($1, $2) RETURNING id, email',
            [email, password] // ¡contraseña sin encriptar!
        )

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: newUser.rows[0]
        })
    } catch (error) {
        console.error('Error en registro:', error)
        res.status(500).json({ error: 'Error al registrar usuario' })
    }
})

// Endpoint para login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body

    try {
        // Buscar usuario por email
        const user = await pool.query(
            'SELECT * FROM usuario WHERE email = $1',
            [email]
        )

        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' })
        }

        // Comparar contraseñas directamente (sin encriptar)
        if (password !== user.rows[0].password) {
            return res.status(401).json({ error: 'Contraseña incorrecta' })
        }

        // Responder con éxito (sin token JWT)
        res.json({
            message: 'Inicio de sesión exitoso',
            user: {
                id: user.rows[0].id,
                email: user.rows[0].email
            }
        })
    } catch (error) {
        console.error('Error en login:', error)
        res.status(500).json({ error: 'Error al iniciar sesión' })
    }
})

// Endpoint para obtener todos los usuarios
app.get('/api/users', async (req, res) => {
    try {
        const users = await pool.query('SELECT id, email FROM usuario')
        res.json(users.rows)
    } catch (error) {
        console.error('Error al obtener usuarios:', error)
        res.status(500).json({ error: 'Error al obtener usuarios' })
    }
})

/**
 * @route POST /api/valoraciones
 * @desc Crea o actualiza una valoración de producto por usuario
 */
app.post('/api/valoraciones', async (req, res) => {
    const { idusuario, idproducto, puntuacion } = req.body

    // Validar los datos de entrada
    if (!idusuario || !idproducto || !puntuacion) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }

    if (puntuacion < 1 || puntuacion > 5) {
        return res.status(400).json({ error: 'La puntuación debe estar entre 1 y 5' })
    }

    try {
        // Verificar si el usuario existe
        const usuarioExists = await pool.query(
            'SELECT id FROM usuario WHERE id = $1',
            [idusuario]
        )

        if (usuarioExists.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' })
        }

        // Verificar si el producto existe
        const productoExists = await pool.query(
            'SELECT id FROM productos WHERE id = $1',
            [idproducto]
        )

        if (productoExists.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' })
        }

        // Insertar o actualizar la valoración (UPSERT)
        const result = await pool.query(`
        INSERT INTO puntuacion (idusuario, idproducto, puntuacion)
        VALUES ($1, $2, $3)
        ON CONFLICT (idusuario, idproducto) 
        DO UPDATE SET puntuacion = EXCLUDED.puntuacion
        RETURNING *
      `, [idusuario, idproducto, puntuacion])

        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error('Error al guardar la valoración:', error)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
})

/**
 * @route GET /api/productos/:id/puntuacion-promedio
 * @desc Obtiene la puntuación promedio de un producto
 */
app.get('/api/productos/:id/puntuacion-promedio', async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query(`
        SELECT AVG(puntuacion) as promedio, COUNT(*) as total_valoraciones
        FROM puntuacion
        WHERE idproducto = $1
      `, [id])

        res.json({
            promedio: parseFloat(result.rows[0].promedio) || 0,
            total_valoraciones: parseInt(result.rows[0].total_valoraciones) || 0
        })
    } catch (error) {
        console.error('Error al obtener puntuación promedio:', error)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
})

/**
 * @route GET /api/valoraciones/usuario/:idusuario
 * @desc Obtiene todas las valoraciones de un usuario específico
 */
app.get('/api/valoraciones/usuario/:idusuario', async (req, res) => {
    const { idusuario } = req.params

    try {
        const result = await pool.query(
            'SELECT idproducto, puntuacion FROM puntuacion WHERE idusuario = $1',
            [idusuario]
        )
        res.json(result.rows)
    } catch (error) {
        console.error('Error al obtener valoraciones:', error)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
})

const PORT_APP = 3000
app.listen(PORT_APP, () => {
    console.log(`server runing on port ${PORT_APP}`)
})
const PORT_SERVER = 3030
server.listen(PORT_SERVER, () => {
    console.log(`WS escuchando en http://localhost:${PORT_SERVER}`)
})
