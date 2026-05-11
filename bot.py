import asyncio
from playwright.async_api import async_playwright
import telebot
import re

# --- CONFIGURACIÓN ---
TOKEN = '8759327102:AAF31T46lO5FtjolBQHMYZrFniDj9_nUcEY'
bot = telebot.TeleBot(TOKEN)

PROXY_SERVER = "http://brd.superproxy.io:33335"
PROXY_USER = "brd-customer-hl_9d5e1af3-zone-datacenter_proxy1"
PROXY_PASS = "a2ltegwg9hs2"

async def bypass_logic(url, site_type):
    async with async_playwright() as p:
        proxy = {
            "server": PROXY_SERVER,
            "username": PROXY_USER,
            "password": PROXY_PASS
        }

        # Lanzamos con headless=False si tienes problemas de detección
        browser = await p.chromium.launch(headless=True, proxy=proxy)
        
        # Usamos un contexto con más "apariencia humana"
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 720}
        )
        page = await context.new_page()
        
        # Inicializamos key_element para evitar UnboundLocalError
        key_element = None
        
        try:
            # Extraer solo la URL del texto (por si el usuario manda texto extra)
            clean_url = re.search(r'(https?://\S+)', url)
            if not clean_url:
                return "No se encontró una URL válida en el mensaje."
            
            await page.goto(clean_url.group(0), timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                await asyncio.sleep(18)
                # Intentamos varios selectores comunes
                button = await page.wait_for_selector("button:has-text('Get'), #copybutton, .btn-primary", timeout=15000)
                if button: 
                    await button.click()
                await asyncio.sleep(3)
                key_element = await page.query_selector("code, #key-display, input[readonly], .key-text")

            elif site_type == "delta":
                print("Procesando Delta...")
                await asyncio.sleep(15)
                button = await page.wait_for_selector("button:has-text('Continue'), button:has-text('Proceed')", timeout=15000)
                if button: 
                    await button.click()
                await asyncio.sleep(5)
                key_element = await page.query_selector(".key-box, #delta-key, .code-text, #key")

            if key_element:
                key = await key_element.inner_text() or await key_element.get_attribute("value")
                return f"🔑 `{key.strip()}`"
            
            return "No se detectó el elemento de la Key. El sitio pudo haber cambiado o detectó el bot."

        except Exception as e:
            return f"❌ Error técnico: {str(e)}"
        finally:
            await browser.close()

# --- HANDLERS ---

@bot.message_handler(func=lambda message: "nabzclan.vip" in message.text.lower())
def handle_nabz(message):
    bot.reply_to(message, "⏳ Saltando NabzClan... (Uso de Proxy Bright Data)")
    # Ejecución asíncrona dentro de entorno síncrono
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(bypass_logic(message.text, "nabzclan"))
    bot.send_message(message.chat.id, result, parse_mode="Markdown")
    loop.close()

@bot.message_handler(func=lambda message: "delta" in message.text.lower())
def handle_delta(message):
    bot.reply_to(message, "⏳ Intentando obtener Key de Delta... esto tardará unos segundos.")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(bypass_logic(message.text, "delta"))
    bot.send_message(message.chat.id, result, parse_mode="Markdown")
    loop.close()

if __name__ == "__main__":
    print("Bot en línea y esperando mensajes...")
    bot.infinity_polling()
