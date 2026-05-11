import asyncio
import os
import re
from playwright.async_api import async_playwright
import playwright_stealth
from telebot.async_telebot import AsyncTeleBot

# --- CONFIGURACIÓN ---
TOKEN = os.getenv('TELEGRAM_TOKEN')
bot = AsyncTeleBot(TOKEN)

PROXY_SERVER = "http://brd.superproxy.io:33335"
PROXY_USER = "brd-customer-hl_9d5e1af3-zone-datacenter_proxy1"
PROXY_PASS = "a2ltegwg9hs2"

async def bypass_logic(url, site_type):
    async with async_playwright() as p:
        proxy = {"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS}
        
        browser = await p.chromium.launch(
            headless=True, 
            proxy=proxy,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Sigilo aplicado correctamente sin causar ImportError
        await playwright_stealth.stealth_async(page)

        try:
            # Extraer link del mensaje
            match = re.search(r'(https?://\S+)', url)
            target_url = match.group(0) if match else url
            
            # Navegar al sitio
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # Lógica completa de clicks para Ad Gate (Nabzclan)
                pasos = ["Start Now", "Step 1", "Step 2", "Step 3", "Get AdCode"]
                for texto in pasos:
                    try:
                        # Buscamos el botón por texto de forma flexible
                        btn = await page.wait_for_selector(f"text=/{texto}/i", timeout=15000)
                        if btn:
                            await btn.click()
                            # Si es un Step, esperamos el contador de 10-11 segundos
                            if "Step" in texto:
                                await asyncio.sleep(11)
                            else:
                                await asyncio.sleep(4)
                    except:
                        # Si un paso no aparece, intentamos seguir al siguiente
                        continue
                
                # Intentar extraer la Key de los selectores comunes
                el = await page.query_selector("code, #key-display, .key-container, .key-box")
                key_result = await el.inner_text() if el else "No se pudo extraer la Key automáticamente."

            elif site_type == "delta":
                # Lógica para Delta Executor
                await asyncio.sleep(15) # Espera inicial por seguridad
                btn = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if btn:
                    await btn.click()
                    await asyncio.sleep(5)
                el = await page.query_selector(".key-box, #key, .code-text")
                key_result = await el.inner_text() if el else "Key de Delta no encontrada."

            return f"🔑 `{key_result.strip()}`"

        except Exception as e:
            return f"❌ Error en el bypass: {str(e)}"
        finally:
            await browser.close()

# --- MANEJADORES DE TELEGRAM ---

@bot.message_handler(commands=['start'])
async def send_welcome(message):
    await bot.reply_to(message, "✅ Bot en línea. Envíame un enlace de Nabzclan o Delta.")

@bot.message_handler(func=lambda m: "nabzclan.vip" in m.text.lower())
async def handle_nabz(message):
    wait_msg = await bot.reply_to(message, "⏳ Procesando Nabzclan... (Esto toma ~45s)")
    resultado = await bypass_logic(message.text, "nabzclan")
    await bot.edit_message_text(resultado, message.chat.id, wait_msg.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda m: "delta" in m.text.lower())
async def handle_delta(message):
    wait_msg = await bot.reply_to(message, "⏳ Procesando Delta...")
    resultado = await bypass_logic(message.text, "delta")
    await bot.edit_message_text(resultado, message.chat.id, wait_msg.message_id, parse_mode="Markdown")

# --- ARRANQUE DEL BOT ---

async def main():
    print("Iniciando bot...")
    await bot.polling(non_stop=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
    except Exception as e:
        print(f"Error crítico al arrancar: {e}")
