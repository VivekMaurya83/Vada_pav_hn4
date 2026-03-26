import sys
import asyncio
from playwright.async_api import async_playwright

async def run():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://google.com")
        print("Page title:", await page.title())
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
