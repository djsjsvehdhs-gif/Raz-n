import asyncio
import os
import re
from playwright.async_api import async_playwright
from telebot.async_telebot import AsyncTeleBot

# --- CONFIGURACIÓN ---
TOKEN = os.getenv('TELEGRAM_TOKEN')
bot = AsyncTeleBot(TOKEN)

PROXY_SERVER = "http://brd.superproxy.io:33335"
PROXY_USER = "brd-customer-hl_9d5e1af3-zone-datacenter_proxy1"
PROXY_PASS = "a2ltegwg9hs2"

async def bypass_logic(url, site_type):
    # Usamos un solo bloque de error para el lanzamiento del navegador
    async with async_playwright() as p:
        proxy = {"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS}
        
        browser = await p.chromium.launch(
            headless=True, 
            proxy=proxy,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-setuid-sandbox"
            ]
        )
        
        # Un User Agent real es vital para evitar bloqueos
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Bloqueo de multimedia mejorado
        await page.route("**/*", lambda route: route.abort() 
            if route.request.resource_type in ["image", "media", "font"] 
            else route.continue_()
        )
        
        key_result = "No se detectó la Key."
        
        try:
            clean_url_match = re.search(r'(https?://\S+)', url)
            if not clean_url_match: return "URL no válida."
            target_url = clean_url_match.group(0)
            
            # Navegación con espera a que la red esté algo ociosa
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                await asyncio.sleep(18)
                # Selector más flexible: busca el botón que contenga "Get"
                button = await page.wait_for_selector("button:has-text('Get'), a:has-text('Get')", timeout=15000)
                if button: 
                    await button.click()
                    await asyncio.sleep(5)
                
                # Intentamos varios selectores comunes para keys
                el = await page.query_selector("code, #key-display, .key-container")
                if el: key_result = await el.inner_text()

            elif site_type == "delta":
                await asyncio.sleep(15)
                button = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if button: 
                    await button.click()
                    await asyncio.sleep(5)
                el = await page.query_selector(".key-box, .code-text, #key")
                if el: key_result = await el.inner_text()

            return f"🔑 `{key_result.strip()}`"

        except Exception as e:
            return f"❌ Error: {str(e)}"
        finally:
            await browser.close() # Cerrar el browser cierra contextos y páginas

# Handlers
@bot.message_handler(func=lambda message: "nabzclan.vip" in message.text.lower())
async def handle_nabz(message):
    sent_msg = await bot.reply_to(message, "⏳ Procesando Nabz...")
    result = await bypass_logic(message.text, "nabzclan")
    await bot.edit_message_text(result, message.chat.id, sent_msg.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda message: "delta" in message.text.lower())
async def handle_delta(message):
    sent_msg = await bot.reply_to(message, "⏳ Procesando Delta...")
    result = await bypass_logic(message.text, "delta")
    await bot.edit_message_text(result, message.chat.id, sent_msg.message_id, parse_mode="Markdown")

# --- CORRECCIÓN EN EL ARRANQUE ---
async def main():
    print("Bot optimizado iniciado...")
    # polling() en AsyncTeleBot debe ser esperado con await
    await bot.polling(non_stop=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
