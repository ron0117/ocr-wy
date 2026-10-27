# 微信公众号推文工作区

与 Cursor 规则 [`.cursor/rules/wechat-article.mdc`](../.cursor/rules/wechat-article.mdc) 和主编提示词 [`.cursor/prompts/wechat-article-editor.md`](../.cursor/prompts/wechat-article-editor.md) 配套使用。

## 目录约定

```
docs/wechat/
  README.md                 # 本说明
  _template/                # 新开一篇时复制此目录
    brief.md
    article.md
    delivery.md
  YYYY-MM-主题-slug/        # 单篇产物
    brief.md                # 需求 brief（定位、读者、目的等）
    delivery.md             # 看点、标题、摘要、群文案、封面/海报、配图、核对清单、自审
    article.md              # 终稿正文（Markdown，供 gzh-design 排版）
    article.html            # gzh-design 排版正文（纯 section 片段）
    article_预览.html       # 可选：带「复制到公众号」按钮的预览页
```

## 新开一篇

1. 复制 `_template/` 为 `docs/wechat/YYYY-MM-你的主题-slug/`。
2. 填写 `brief.md`（俱乐部信息 + 赛事/活动素材）。
3. 对 Agent 说：「按 `brief.md` 与 `.cursor/prompts/wechat-article-editor.md` 写推文，`delivery.md` + `article.md` 写入同目录。」
4. 终稿确认后：「用 gzh-design 将本目录 `article.md` 排成公众号 HTML，输出 `article.html`。」

## 示例

完整走通的一篇（brief + delivery + 终稿）：

- [`2026-10-activity-signup/`](./2026-10-activity-signup/)

主题：**俱乐部线下活动报名，如何少在 Excel 和微信群之间倒腾**。brief 为示例数据，发布前请按你们公众号实际情况改定位与 CTA。
