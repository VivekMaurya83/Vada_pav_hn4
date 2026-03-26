import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
    FEATHERLESS_API_URL = "https://api.featherless.ai/v1/chat/completions"
    MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324"
    RULES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "act-mapping-wcag22-final.json")

config = Config()
