# ===== 邮件发送服务（SMTP + 控制台兜底） =====
# 说明：
# - 真实发送依赖 SMTP 环境变量（DM_SMTP_*），由部署方配置，本模块不硬编码任何账号。
# - SMTP 未配置或发送失败时自动回退到控制台打印（开发兜底），保证本地联调不中断。
# - HTML 模板为独立文件：server/templates/email/verification_email.html，可直接单独维护；
#   模板文件缺失时使用内置兜底 HTML，不影响运行。
# - SMTP 连接自动支持 SSL（QQ/163 常用 465/994）与 STARTTLS（587）。
import os
import smtplib
import logging
import html
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import (
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_TLS, SMTP_SSL,
)

logger = logging.getLogger("每日食方")

# HTML 模板文件路径（与当前文件同级的 templates/email/ 目录）
_TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "templates", "email", "verification_email.html"
)

# 四种验证码场景的展示信息（标题 / 副文案）
_PURPOSE_INFO = {
    "register": {
        "label": "注册账号",
        "headline": "欢迎加入每日食方",
        "intro": "你正在注册「每日食方」账号，请输入下方验证码完成注册，开启你的智能食谱规划之旅。",
    },
    "password_reset": {
        "label": "找回密码",
        "headline": "重置你的登录密码",
        "intro": "你正在使用邮箱找回密码。为确保是本人操作，请输入下方验证码后设置新密码。",
    },
    "email_verify": {
        "label": "邮箱验证",
        "headline": "验证新的邮箱地址",
        "intro": "你正在绑定或更换账号邮箱。请输入下方验证码，确认新邮箱地址真实有效。",
    },
    "deactivate": {
        "label": "注销账号",
        "headline": "确认注销账号",
        "intro": "你正在注销「每日食方」账号。请输入下方验证码完成确认，注销后账号将无法登录。",
    },
}

# 通用场景兜底
_DEFAULT_INFO = {
    "label": "账号验证",
    "headline": "请完成安全验证",
    "intro": "你正在进行账号安全操作，请输入下方验证码继续。",
}

# 模板文件缺失时的内置兜底（结构与独立模板一致，便于离线运行）
_FALLBACK_TEMPLATE = """\
<div style="background-color: #F4F4F5; margin: 0; padding: 24px 12px; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden;">
    <div style="background: #4F46E5; color: #FFFFFF; padding: 22px 32px; font-size: 18px; font-weight: 700;">每日食方 · 智能食谱规划</div>
    <div style="padding: 20px 32px 4px;">
      <div style="display: inline-block; background: #EEF2FF; color: #4338CA; border-radius: 999px; padding: 3px 12px; font-size: 13px;">{{label}} · 邮箱验证</div>
    </div>
    <div style="padding: 12px 32px 0;">
      <div style="font-size: 22px; font-weight: 700; color: #1F2937;">{{headline}}</div>
      <div style="font-size: 14px; color: #6B7280; line-height: 1.8; margin-top: 8px;">{{intro}}</div>
    </div>
    <div style="padding: 20px 32px;">
      <div style="text-align: center; background: #F4F4F5; border: 1px dashed #C7D2FE; border-radius: 12px; padding: 22px;">
        <div style="font-size: 13px; color: #6B7280; margin-bottom: 8px;">你的验证码</div>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4338CA; font-family: Consolas, Menlo, monospace;">{{code}}</div>
        <div style="font-size: 13px; color: #6B7280; margin-top: 10px;">有效期 <span style="color: #DC2626; font-weight: 600;">10 分钟</span>，请勿向任何人透露</div>
      </div>
    </div>
    <div style="padding: 0 32px 14px; font-size: 13px; color: #6B7280; line-height: 1.9;">
      如果不是你本人操作，请忽略此邮件，你的账号不会受到影响。
    </div>
    <div style="padding: 14px 32px 20px; border-top: 1px solid #F3F4F6; font-size: 12px; color: #9CA3AF;">此邮件由系统自动发送，请勿直接回复。</div>
  </div>
</div>
"""

_template_cache: str | None = None


def _load_html_template() -> str:
    """加载独立 HTML 模板文件；文件缺失时使用内置兜底模板。"""
    global _template_cache
    if _template_cache is not None:
        return _template_cache
    try:
        with open(_TEMPLATE_PATH, encoding="utf-8") as f:
            _template_cache = f.read()
    except FileNotFoundError:
        logger.warning(f"HTML 邮件模板不存在（{_TEMPLATE_PATH}），使用内置兜底模板")
        _template_cache = _FALLBACK_TEMPLATE
    return _template_cache


def is_smtp_configured() -> bool:
    """检查 SMTP 是否已配置（可发送真实邮件）"""
    return bool(SMTP_HOST) and bool(SMTP_USER)


def _use_ssl() -> bool:
    """根据 DM_SMTP_SSL 与端口判断是否使用 SSL 加密连接。"""
    if SMTP_SSL in ("true", "1", "yes"):
        return True
    if SMTP_SSL in ("false", "0", "no"):
        return False
    # auto：QQ(465) / 163(465,994) 等 SSL 端口自动启用
    return SMTP_PORT in (465, 994)


def _render_verification_html(label: str, headline: str, intro: str, code: str) -> str:
    """渲染验证码邮件 HTML（占位符均已转义，避免注入破坏模板）。"""
    template = _load_html_template()
    for key, value in (
        ("{{label}}", label),
        ("{{headline}}", headline),
        ("{{intro}}", intro),
        ("{{code}}", code),
    ):
        template = template.replace(key, html.escape(value, quote=True))
    return template


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """发送邮件（同步阻塞，返回是否成功）。自动支持 SSL / STARTTLS。"""
    if not is_smtp_configured():
        logger.warning("SMTP 未配置（DM_SMTP_*），无法发送真实邮件")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["X-Mailer"] = "每日食方"
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        if _use_ssl():
            # SSL 模式：QQ/163 邮箱常用 465 / 994 端口
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30)
        else:
            # STARTTLS 模式：587 端口等
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
            if SMTP_TLS:
                server.starttls()
        with server:
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())

        logger.info(f"邮件已发送到 {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"邮件发送失败（{to_email}）: {e}")
        return False


def send_verification_code(email: str, code: str, purpose: str) -> dict:
    """
    发送验证码邮件（HTML 品牌模板 + 纯文本双版本）。
    如果 SMTP 已配置，发送真实邮件；否则打印到控制台作为开发兜底。
    返回：{"sent": True} 或 {"sent": True, "devCode": "123456"}
    """
    info = _PURPOSE_INFO.get(purpose, _DEFAULT_INFO)
    purpose_label = info["label"]

    # 纯文本正文（兼容不支持 HTML 的环境 / 摘要预览）
    text_body = (
        f"你好，\n\n"
        f"你正在进行「{purpose_label}」操作，验证码为：\n\n"
        f"  {code}\n\n"
        f"验证码有效期为 10 分钟，请尽快使用；请勿向任何人透露验证码。\n"
        f"如果这不是你本人操作，请忽略此邮件，你的账号不会受到影响。\n\n"
        f"—— 每日食方（智能食谱规划）"
    )
    # HTML 品牌模板正文（独立文件渲染）
    html_body = _render_verification_html(purpose_label, info["headline"], info["intro"], code)
    subject = f"[每日食方] {purpose_label} 验证码"

    if is_smtp_configured():
        ok = send_email(email, subject, text_body, html_body)
        if ok:
            logger.info(f"[每日食方] 已通过 SMTP 发送验证码邮件到 {email}")
            return {"sent": True}
        logger.warning("SMTP 发送失败，转用控制台兜底")

    # 开发兜底：打印验证码到控制台，前端开发模式可直接显示
    logger.info(f"[DEV] 验证码: {code} (用于: {purpose}, 邮箱: {email})")
    print(f"\n========== [DEV] 验证码 ==========")
    print(f"  邮箱: {email}")
    print(f"  用途: {purpose_label}")
    print(f"  验证码: {code}")
    print(f"  有效期: 10 分钟")
    print(f"==================================\n")
    return {"sent": True, "devCode": code}
