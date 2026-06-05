const { initDb } = require('./db');
const { app } = require('./app');

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Library API running at http://localhost:${PORT}`);
    console.log(`Swagger UI:        http://localhost:${PORT}/api-docs`);
    console.log(`OpenAPI JSON:      http://localhost:${PORT}/api-docs.json`);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
