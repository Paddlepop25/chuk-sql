// load express, handlebars, mysql2
const express = require('express')
const handlebars = require('express-handlebars')
// get the driver with promise support
const mysql = require('mysql2/promise')
require('dotenv').config()

// SQL
// never use string concatenation in SQL query
// one statement no need semi colon. multi statement then need
// SQL driver only do one at a time. If want multiple statements need to turn on. We should do one at a time
const SQL_FIND_BY_NAME = 'select * from apps where name like ? limit ?,?'
const SQL_RESULT_COUNT = 'select count(*) as count from apps where name like ?'

// configure PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

// create the database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'playstore',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
  timezone: '+8:00',
})

const startApp = async (app, pool) => {
  try {
    // get a connection from the connection pool
    const conn = await pool.getConnection()

    console.info('Pinging database')
    await conn.ping()

    // release the connection
    conn.release()

    // start the server only if connected to database
    app.listen(PORT, () => {
      console.info(`Application started on port ${PORT} at ${new Date()}`)
    })
  } catch (exception) {
    console.error('Cannot ping database: ', exception)
  }
}

// create an instance of express
const app = express()

// configure handlebars
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }))
app.set('view engine', 'hbs')

// configure the application
app.get('/', (req, res) => {
  res.status(200)
  res.type('text/html')
  res.render('index')
})

app.get('/search/page:page', async (req, res) => {
  const page = parseInt(req.params['page'])
  console.info('currently on page ---> ', page)
  const prevPage = page - 1
  console.info('prevPage --->', prevPage)
  const nextPage = page + 1
  console.info('nextPage --->', nextPage)

  const limit = 5 //constant
  const offset = (page - 1) * limit
  console.info('offset --->', offset)

  const q = req.query['search']
  console.info('search term ---> ', q) // search

  // acquire a connection from the pool
  const conn = await pool.getConnection()

  try {
    const resultCount = await conn.query(SQL_RESULT_COUNT, [`%${q}%`])
    const count = resultCount[0][0].count
    console.info('count ---->', count)

    const totalPages = Math.ceil(count / limit)
    console.log('totalPages ---> ', totalPages)

    let hasPrevPage = true
    let hasNextPage = true

    if (page == 1) hasPrevPage = false
    if (page == totalPages) hasNextPage = false

    /*
    perform the query
    const SQL_FIND_BY_NAME = 'select * from apps where name like ? limit ?'
    2nd parameter is array of the ? above
    query returns a promise. return an array of 2 elements
    1st element will hold array of results. 
    2nd element is the metadata on the record, usually we don't need to look at it. so result[0]
    */
    const result = await conn.query(SQL_FIND_BY_NAME, [`%${q}%`, offset, limit])
    const recs = result[0]
    const recsLength = recs.length > 0

    res.status(200)
    res.type('text/html')
    res.render('results', {
      q,
      recs,
      recsLength,
      page,
      prevPage,
      nextPage,
      hasPrevPage,
      hasNextPage,
    })
  } catch (err) {
    console.error('error ---->', err)
  } finally {
    // release connection
    conn.release()
  }
})

startApp(app, pool)

// error404
app.use('/', (req, res) => {
  res.status(404)
  res.type('text/html')
  res.render('error404')
})
