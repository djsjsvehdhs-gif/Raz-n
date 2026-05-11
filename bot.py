import asyncio
import os
import re
from playwright.async_api import async_playwright
import playwright_stealth
from telebot.async_telebot import AsyncTeleBot

# Configuración del Token (Si responde el /start, esto está bien)
TOKEN = os.getenv('TELEGRAM_TOKEN')
bot = AsyncTeleBot(TOKEN)

PROXY_SERVER = "http://brd.superproxy.io:33335"
PROXY_USER = "brd-customer-hl_9d5e1af3-zone-datacenter_proxy1"
PROXY_PASS = "a2ltegwg9hs2"

async def bypass_logic(url, site_type):
    async with async_playwright() as p:
        proxy = {"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS}
        
        # Lanzamiento del navegador
        browser = await p.chromium.launch(
            headless=True, 
            proxy=proxy,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Activar sigilo (Corregido para evitar el ImportError)
        await playwright_stealth.stealth_async(page)

        try:
            # Extraer link limpio
            match = re.search(r'(https?://\S+)', url)
            target_url = match.group(0) if match else url
            
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # Lógica de clicks para Ad Gate
                pasos = ["Start Now", "Step 1", "Step 2", "Step 3", "Get AdCode"]
                for texto in pasos:
                    try:
                        # Esperar al botón y hacer click
                        btn = await page.wait_for_selector(f"text=/{texto}/i", timeout=12000)
                        if btn:
                            await btn.click()
                            # Si es un paso intermedio, esperar el contador
                            if "Step" in texto:
                                await asyncio.sleep(11)
                            else:
                                await asyncio.sleep(3)
                    except:
                        continue
                
                # Buscar la Key final
                el = await page.query_selector("code, #key-display, .key-container, .key-box")
                key_result = await el.inner_text() if el else "No se pudo extraer la Key"

            elif site_type == "delta":
                # Lógica para Delta
                await asyncio.sleep(15)
                btn = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if btn:
                    await btn.click()
                    await asyncio.sleep(5)
                el = await page.query_selector(".key-box, #key, .code-text")
                key_result = await el.inner_text() if el else "Key no encontrada"

            return f"🔑 `{key_result.strip()}`"

        except Exception as e:
            return f"❌ Error en el proceso: {str(e)}"
        finally:
            await browser.close()

# --- HANDLERS ---

@bot.message_handler(commands=['start'])
async def send_welcome(message):
    await bot.reply_to(message, "✅ ¡Bot activo y listo! Envíame un link.")

@bot.message_handler(func=lambda m: "nabzclan.vip" in m.text.lower())
async def handle_nabz(message):
    wait = await bot.reply_to(message, "⏳ Saltando Nabzclan... esto tarda unos 40s.")
    res = await bypass_logic(message.text, "nabzclan")
    await bot.edit_message_text(res, message.chat.id, wait.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda m: "delta" in m.text.lower())
async def handle_delta(message):
    wait = await bot.reply_to(message, "⏳ Saltando Delta...")
    res = await bypass_logic(message.text, "delta")
    await bot.edit_message_text(res, message.chat.id, wait.message_id, parse_mode="Markdown")

# --- ARRANQUE ---

async def main():
    print("Bot encendido correctamente...")
    await bot.polling(non_stop=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Fallo crítico: {e}")
