'use client';

import { BackNavLink } from '@/components/back-nav-link';
import { guidePost, guideUploadWikiImage } from '@/lib/api';
import { renderMentorMarkdown } from '@/lib/render-markdown';
import type { GuideArticleCreatedDto, PathwayDto } from '@ocr/guide-types';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import '../article.css';

type Props = {
  pathways: PathwayDto[];
};

export function ArticleWriteForm({ pathways }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [summary, setSummary] = useState('');
  const [pathwaySlug, setPathwaySlug] = useState('');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich');
  const [markdown, setMarkdown] = useState('');
  const markdownRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: '正文：支持标题、列表、插图。也可以切换到 Markdown。' }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    editorProps: {
      attributes: {
        class: 'article-editor-body',
      },
    },
  });

  const insertMarkdown = (before: string, after = '', placeholder = '') => {
    const el = markdownRef.current;
    const current = el?.value ?? markdown;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const selected = current.slice(start, end) || placeholder;
    const next = current.slice(0, start) + before + selected + after + current.slice(end);
    setMarkdown(next);
    const cursor = start + before.length + selected.length + after.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  const insertImage = async (file: File) => {
    if (mode === 'rich' && !editor) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await guideUploadWikiImage(file);
      if (mode === 'markdown') {
        const alt = file.name.replace(/[\[\]\r\n]/g, '');
        insertMarkdown(`![${alt}](${url})`, '', '');
        return;
      }
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (e) {
      setError(e instanceof Error ? e.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onPickImage = () => fileRef.current?.click();

  const onPublish = async () => {
    const bodyHtml = mode === 'markdown' ? renderMentorMarkdown(markdown) : editor?.getHTML() ?? '';
    if (!bodyHtml.trim()) {
      setError('正文不能为空');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const created = await guidePost<GuideArticleCreatedDto>('/articles', {
        title,
        authorName,
        summary: summary.trim() || undefined,
        bodyHtml,
        pathwaySlug: pathwaySlug || undefined,
      });
      router.push(created.urlPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="article-write">
      <BackNavLink href="/guides" refresh>
        返回攻略库
      </BackNavLink>

      <header className="page-header">
        <h1>写攻略</h1>
        <p className="muted page-header-lead">
          可以用富文本，也可以写 Markdown。发布时会转成文章排版；插图上传至 COS（wiki/ 前缀）
        </p>
      </header>

      <div className="article-write-form">
        <label className="article-field">
          标题
          <input
            type="text"
            maxLength={120}
            value={title}
            placeholder="例如：观众途径 PVE 开荒要点"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="article-field">
          作者昵称
          <input
            type="text"
            maxLength={40}
            value={authorName}
            placeholder="展示在文章页的名称"
            onChange={(e) => setAuthorName(e.target.value)}
          />
        </label>

        <label className="article-field">
          摘要（可选）
          <input
            type="text"
            maxLength={500}
            value={summary}
            placeholder="列表页短描述，不填则从正文截取"
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        <label className="article-field">
          相关途径（可选）
          <select value={pathwaySlug} onChange={(e) => setPathwaySlug(e.target.value)}>
            <option value="">不限定</option>
            {pathways.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.professionLabel}
              </option>
            ))}
          </select>
        </label>

        <div className="article-editor-wrap">
          <div className="article-editor-toolbar">
            <button
              type="button"
              className={mode === 'rich' ? 'btn-ghost is-active' : 'btn-ghost'}
              onClick={() => setMode('rich')}
            >
              富文本
            </button>
            <button
              type="button"
              className={mode === 'markdown' ? 'btn-ghost is-active' : 'btn-ghost'}
              onClick={() => setMode('markdown')}
            >
              Markdown
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={mode === 'rich' && !editor}
              onClick={() =>
                mode === 'markdown'
                  ? insertMarkdown('**', '**', '文字')
                  : editor?.chain().focus().toggleBold().run()
              }
            >
              粗体
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={mode === 'rich' && !editor}
              onClick={() =>
                mode === 'markdown'
                  ? insertMarkdown('*', '*', '文字')
                  : editor?.chain().focus().toggleItalic().run()
              }
            >
              斜体
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={mode === 'rich' && !editor}
              onClick={() =>
                mode === 'markdown'
                  ? insertMarkdown('\n## ', '', '小标题')
                  : editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              小标题
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={mode === 'rich' && !editor}
              onClick={() =>
                mode === 'markdown'
                  ? insertMarkdown('\n- ', '', '列表项')
                  : editor?.chain().focus().toggleBulletList().run()
              }
            >
              列表
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={mode !== 'markdown'}
              onClick={() => insertMarkdown('\n```\n', '\n```\n', '代码')}
            >
              代码块
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={(mode === 'rich' && !editor) || uploading}
              onClick={onPickImage}
            >
              {uploading ? '上传中…' : '插入图片'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void insertImage(file);
              }}
            />
          </div>
          {mode === 'markdown' ? (
            <>
              <textarea
                ref={markdownRef}
                className="article-markdown-input"
                value={markdown}
                placeholder={'直接写 Markdown，例如：\n## 小标题\n**粗体**、[链接](https://example.com)\n![配图](图片地址)\n```\n导入码\n```'}
                onChange={(e) => setMarkdown(e.target.value)}
              />
              <div className="article-markdown-preview">
                <p className="muted">预览</p>
                {markdown.trim() ? (
                  <article
                    className="article-prose"
                    dangerouslySetInnerHTML={{ __html: renderMentorMarkdown(markdown) }}
                  />
                ) : (
                  <p className="muted">写一点内容后，这里会按发布后的排版显示。</p>
                )}
              </div>
            </>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {error ? <div className="build-error">{error}</div> : null}

        <div className="article-write-actions">
          <button
            type="button"
            className="button button-gold"
            disabled={publishing || uploading || !title.trim() || !authorName.trim()}
            onClick={() => void onPublish()}
          >
            {publishing ? '发布中…' : '发布攻略'}
          </button>
        </div>
      </div>
    </div>
  );
}
