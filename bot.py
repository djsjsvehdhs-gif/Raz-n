import asyncio
import os
import re
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
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
            args=["--disable-dev-shm-usage", "--no-sandbox"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Activar sigilo correctamente
        try:
            await stealth_async(page)
        except:
            pass

        try:
            clean_url_match = re.search(r'(https?://\S+)', url)
            if not clean_url_match: return "URL no válida."
            target_url = clean_url_match.group(0)
            
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # Paso 1: Clic en Start Now
                try:
                    start = await page.wait_for_selector("text=/Start Now/i", timeout=10000)
                    if start: await start.click()
                except: pass
                
                # Paso 2: Los 3 botones Step 1, 2, 3
                for i in range(1, 4):
                    try:
                        step = await page.wait_for_selector(f"text=/Step {i}/i", timeout=15000)
                        if step:
                            await step.click()
                            await asyncio.sleep(12) 
                    except: continue
                
                # Paso 3: Obtener Key
                get_btn = await page.wait_for_selector("text=/Get AdCode/i", timeout=15000)
                if get_btn: 
                    await get_btn.click()
                    await asyncio.sleep(5)
                
                el = await page.query_selector("code, #key-display, .key-container")
                key_result = await el.inner_text() if el else "No se halló la key."
            
            else: # Delta
                await asyncio.sleep(15)
                btn = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if btn: await btn.click()
                await asyncio.sleep(5)
                el = await page.query_selector(".key-box, #key")
                key_result = await el.inner_text() if el else "No se halló la key."

            return f"🔑 `{key_result.strip()}`"
        except Exception as e:
            return f"❌ Error: {str(e)}"
        finally:
            await browser.close()

# --- HANDLERS ---
@bot.message_handler(commands=['start'])
async def handle_start(message):
    await bot.reply_to(message, "✅ Bot activo. Envía un enlace de Nabzclan o Delta.")

@bot.message_handler(func=lambda m: "nabzclan.vip" in m.text.lower())
async def handle_nabz(message):
    sent = await bot.reply_to(message, "⏳ Procesando Nabz...")
    res = await bypass_logic(message.text, "nabzclan")
    await bot.edit_message_text(res, message.chat.id, sent.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda m: "delta" in m.text.lower())
async def handle_delta(message):
    sent = await bot.reply_to(message, "⏳ Procesando Delta...")
    res = await bypass_logic(message.text, "delta")
    await bot.edit_message_text(res, message.chat.id, sent.message_id, parse_mode="Markdown")

async def main():
    print("Bot optimizado iniciado...")
    await bot.polling(non_stop=True)

if __name__ == "__main__":
    asyncio.run(main())
