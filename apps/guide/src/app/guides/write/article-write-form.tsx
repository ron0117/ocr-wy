'use client';

import { BackNavLink } from '@/components/back-nav-link';
import { guidePost, guideUploadWikiImage } from '@/lib/api';
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: '正文：支持标题、列表、插图…' }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    editorProps: {
      attributes: {
        class: 'article-editor-body',
      },
    },
  });

  const insertImage = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await guideUploadWikiImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (e) {
      setError(e instanceof Error ? e.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onPickImage = () => fileRef.current?.click();

  const onPublish = async () => {
    if (!editor) return;
    const bodyHtml = editor.getHTML();
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
        <p className="muted page-header-lead">图文会保存到攻略库；插图上传至 COS（wiki/ 前缀）</p>
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
              className="btn-ghost"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              粗体
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              斜体
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              小标题
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              列表
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!editor || uploading}
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
          <EditorContent editor={editor} />
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
