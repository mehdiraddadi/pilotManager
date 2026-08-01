import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`🚀 API démarrée sur http://localhost:${env.port}/api`);
  console.log(`   Health check : http://localhost:${env.port}/api/health`);
});
