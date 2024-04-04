/* eslint-disable indent */
const pg = require('pg')

const pool = new pg.Pool({
    connectionString: 'postgres://postgres:admin@localhost:5432/quickorder'
})

module.exports = pool
