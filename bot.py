import asyncio
import os
import re
from playwright.async_api import async_playwright
import playwright_stealth
from telebot.async_telebot import AsyncTeleBot

# Validación de seguridad para el Token
TOKEN = os.getenv('TELEGRAM_TOKEN')
if TOKEN is None or len(TOKEN) < 10:
    print("❌ ERROR FATAL: No se encontró la variable TELEGRAM_TOKEN o está vacía.")
    exit(1)

bot = AsyncTeleBot(TOKEN)

PROXY_SERVER = "http://brd.superproxy.io:33335"
PROXY_USER = "brd-customer-hl_9d5e1af3-zone-datacenter_proxy1"
PROXY_PASS = "a2ltegwg9hs2"

async def bypass_logic(url, site_type):
    async with async_playwright() as p:
        proxy = {"server": PROXY_SERVER, "username": PROXY_USER, "password": PROXY_PASS}
        browser = await p.chromium.launch(headless=True, proxy=proxy, args=["--no-sandbox"])
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        page = await context.new_page()
        
        # Sigilo estable
        await playwright_stealth.stealth_async(page)

        try:
            match = re.search(r'(https?://\S+)', url)
            target = match.group(0) if match else url
            await page.goto(target, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # Lógica de clicks secuenciales
                for step in ["Start Now", "Step 1", "Step 2", "Step 3", "Get AdCode"]:
                    try:
                        btn = await page.wait_for_selector(f"text=/{step}/i", timeout=12000)
                        if btn:
                            await btn.click()
                            await asyncio.sleep(11 if "Step" in step else 3)
                    except: continue
                
                el = await page.query_selector("code, #key-display, .key-container")
                res = await el.inner_text() if el else "Key no detectada"
            else:
                await asyncio.sleep(15)
                btn = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if btn: await btn.click()
                el = await page.query_selector(".key-box, #key")
                res = await el.inner_text() if el else "Key no encontrada"

            return f"🔑 `{res.strip()}`"
        except Exception as e:
            return f"❌ Error: {str(e)}"
        finally:
            await browser.close()

@bot.message_handler(commands=['start'])
async def welcome(m):
    await bot.reply_to(m, "✅ Bot encendido y con Token validado.")

@bot.message_handler(func=lambda m: "nabzclan.vip" in m.text.lower())
async def nabz(m):
    msg = await bot.reply_to(m, "⏳ Saltando Nabzclan...")
    res = await bypass_logic(m.text, "nabzclan")
    await bot.edit_message_text(res, m.chat.id, msg.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda m: "delta" in m.text.lower())
async def delta(m):
    msg = await bot.reply_to(m, "⏳ Saltando Delta...")
    res = await bypass_logic(m.text, "delta")
    await bot.edit_message_text(res, m.chat.id, msg.message_id, parse_mode="Markdown")

if __name__ == "__main__":
    print("🚀 Iniciando bot...")
    asyncio.run(bot.polling(non_stop=True))
