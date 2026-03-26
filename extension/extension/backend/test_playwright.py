import asyncio
from playwright.async_api import async_playwright

async def run():
    try:
        async with async_playwright() as pw:
            print("Launching chromium...")
            browser = await pw.chromium.launch(headless=True)
            print("Chromium launched successfully")
            await browser.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
