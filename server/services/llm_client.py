# ===== LLM 客户端：用户配置的 JSON 参数直接透传 =====
import httpx

# 模块级 httpx 客户端单例，复用连接池和 keep-alive
_client = httpx.Client(
    timeout=httpx.Timeout(120.0),
    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
)

# 归一化 base_url
def normalize_endpoint(base_url: str) -> str:
    base_url = base_url.rstrip('/')
    if base_url.endswith('/chat/completions'):
        return base_url
    return f"{base_url}/chat/completions"


# 调用 OpenAI 兼容的 chat/completions 接口
# params 是用户配置的完整请求参数（不含 messages），直接透传给云模型
def chat_completion(
    base_url: str,
    api_key: str,
    params: dict,
    messages: list,
    timeout: float = 60.0,
) -> str:
    """发送聊天请求，返回文本内容"""

    # 以用户配置的 params 为基础，注入 messages
    payload = dict(params)
    payload["messages"] = messages

    # 如果用户没有设置 response_format，默认尝试 json_object
    if "response_format" not in payload:
        payload["response_format"] = {"type": "json_object"}

    url = normalize_endpoint(base_url)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        resp = _client.post(url, json=payload, headers=headers)
        # 如果返回 400 且提示 json_object 不受支持，降级重试
        if resp.status_code == 400 and "json_object" in resp.text:
            del payload["response_format"]
            resp = _client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            detail = resp.text[:300]
            raise LLMError(f"模型接口返回错误（{resp.status_code}）: {detail}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except httpx.ConnectError:
        raise LLMError("无法连接到模型接口，请检查 Base URL 是否正确")
    except httpx.TimeoutException:
        raise LLMError("请求超时，请稍后重试")
    except KeyError:
        raise LLMError("模型返回格式异常")


# LLM 错误类
class LLMError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# 测试模型连接
def test_connection(base_url: str, api_key: str, params: dict) -> tuple:
    """测试连接，返回 (ok, message)"""
    try:
        msg = [{"role": "user", "content": "请回复：连接成功"}]
        content = chat_completion(
            base_url, api_key, params, msg, timeout=30
        )
        return True, "连接成功"
    except LLMError as e:
        return False, e.message
    except Exception as e:
        return False, str(e)