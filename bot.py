import asyncio
import os
import re
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async # <--- Añadido
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
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-setuid-sandbox"
            ]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Aplicar modo incógnito/humano para saltar protecciones
        await stealth_async(page) # <--- Añadido

        # Bloqueo de multimedia (ajustado para permitir estilos y scripts necesarios)
        await page.route("**/*", lambda route: route.abort() 
            if route.request.resource_type in ["image", "media", "font"] 
            else route.continue_()
        )
        
        key_result = "No se detectó la Key."
        
        try:
            clean_url_match = re.search(r'(https?://\S+)', url)
            if not clean_url_match: return "URL no válida."
            target_url = clean_url_match.group(0)
            
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # --- NUEVA LÓGICA POR PASOS (Ad Gate) ---
                # 1. Clic en Start Now
                start_btn = await page.wait_for_selector("text=/Start Now/i", timeout=15000)
                if start_btn: await start_btn.click()
                
                # 2. Ciclo de los 3 botones Step 1, 2, 3
                for i in range(1, 4):
                    step_btn = await page.wait_for_selector(f"text=/Step {i}/i", timeout=15000)
                    if step_btn:
                        await step_btn.click()
                        await asyncio.sleep(12) # Espera del contador de 10s + margen
                
                # 3. Clic en el botón final para generar código
                get_btn = await page.wait_for_selector("button:has-text('Get'), a:has-text('Get'), text=/Get AdCode/i", timeout=15000)
                if get_btn: 
                    await get_btn.click()
                    await asyncio.sleep(5)
                
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
            await browser.close()

# Handlers
@bot.message_handler(commands=['start'])
async def handle_start(message):
    await bot.reply_to(message, "✅ Bot listo. Envía tu enlace de Nabzclan o Delta.")

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

# --- ARRANQUE ---
async def main():
    print("Bot optimizado iniciado...")
    await bot.polling(non_stop=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
