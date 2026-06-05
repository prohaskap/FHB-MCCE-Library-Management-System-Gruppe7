const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Library Management API',
      version: '1.0.0',
      description: 'FHB Test Automation Course — Example Application'
    },
    servers: [{ url: 'http://localhost:3000' }]
  },
  apis: [path.join(__dirname, 'routes', '*.js').replace(/\\/g, '/')]
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use('/api/books',        require('./routes/books'));
app.use('/api/members',      require('./routes/members'));
app.use('/api/loans',        require('./routes/loans'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/search',       require('./routes/search'));
app.use('/api/reports',      require('./routes/reports'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = { app, swaggerSpec };
