import { initializeDb } from "./bot/db.js";
import { startBot } from "./bot/index.js";

async function main() {
  console.log("🚀 Iniciando Neex Store Bot...");

  await initializeDb();
  console.log("✅ Base de datos Firebase conectada");

  startBot();
}

main().catch((err) => {
  console.error("❌ Error fatal al iniciar:", err);
  process.exit(1);
});
