import asyncio
import os
import re
from playwright.async_api import async_playwright
import playwright_stealth
from telebot.async_telebot import AsyncTeleBot

# Si responde /start, el token está perfecto
TOKEN = os.getenv('TELEGRAM_TOKEN')
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

        # --- SISTEMA ANTIBLOQUEO (Prueba todas las opciones) ---
        try:
            await playwright_stealth.stealth_async(page)
        except:
            try:
                from playwright_stealth import stealth
                await stealth(page)
            except:
                pass # Si todo falla, sigue adelante; mejor intentar sin sigilo que crashear

        try:
            match = re.search(r'(https?://\S+)', url)
            target_url = match.group(0) if match else url
            await page.goto(target_url, timeout=60000, wait_until="domcontentloaded")

            if site_type == "nabzclan":
                # Lista de botones a presionar en orden
                for txt in ["Start Now", "Step 1", "Step 2", "Step 3", "Get AdCode"]:
                    try:
                        btn = await page.wait_for_selector(f"text=/{txt}/i", timeout=12000)
                        if btn:
                            await btn.click()
                            await asyncio.sleep(11 if "Step" in txt else 4)
                    except: continue
                
                el = await page.query_selector("code, #key-display, .key-container, .key-box")
                res = await el.inner_text() if el else "No encontré la Key"
            else:
                await asyncio.sleep(15)
                btn = await page.wait_for_selector("button:has-text('Continue')", timeout=15000)
                if btn: await btn.click()
                await asyncio.sleep(5)
                el = await page.query_selector(".key-box, #key, .code-text")
                res = await el.inner_text() if el else "Key no hallada"

            return f"🔑 `{res.strip()}`"
        except Exception as e:
            return f"❌ Error: {str(e)}"
        finally:
            await browser.close()

@bot.message_handler(commands=['start'])
async def welcome(m):
    await bot.reply_to(m, "✅ En línea. Manda el link.")

@bot.message_handler(func=lambda m: "nabzclan.vip" in m.text.lower())
async def handle_nabz(m):
    w = await bot.reply_to(m, "⏳ Saltando Nabzclan...")
    r = await bypass_logic(m.text, "nabzclan")
    await bot.edit_message_text(r, m.chat.id, w.message_id, parse_mode="Markdown")

@bot.message_handler(func=lambda m: "delta" in m.text.lower())
async def handle_delta(m):
    w = await bot.reply_to(m, "⏳ Saltando Delta...")
    r = await bypass_logic(m.text, "delta")
    await bot.edit_message_text(r, m.chat.id, w.message_id, parse_mode="Markdown")

if __name__ == "__main__":
    asyncio.run(bot.polling(non_stop=True))
