import sys
import asyncio
import os

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    # Ensure we are in the extension backend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Import app AFTER setting the loop policy
    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8000)
