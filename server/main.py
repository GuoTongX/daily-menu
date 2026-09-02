# ===== FastAPI 应用入口 =====
import sys
import os
import logging
from contextlib import asynccontextmanager
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import CORS_ORIGINS
from db import init_db
from routers import auth, menus, llm, today, ingredients, recipes, settings, stats, account

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("每日食方")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="每日食方 API", version="0.2.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(auth.router)
app.include_router(menus.router)
app.include_router(llm.router)
app.include_router(today.router)
app.include_router(ingredients.router)
app.include_router(recipes.router)
app.include_router(settings.router)
app.include_router(stats.router)
app.include_router(account.router)


# 健康检查
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)