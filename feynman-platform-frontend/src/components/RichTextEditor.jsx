// src/components/RichTextEditor.jsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import { useEffect } from 'react';
import './RichTextEditor.css';

function RichTextEditor({ value, onChange, placeholder = '开始输入内容...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Markdown,
      Placeholder.configure({
        placeholder
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      try {
        // 获取 Markdown 格式的内容
        const markdown = editor.storage.markdown.getMarkdown();
        onChange?.(markdown);
      } catch (err) {
        console.error('Editor update error:', err);
      }
    },
  });

  // 当外部 value 变化时更新编辑器（例如加载数据）
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor">
      <div style={{ 
        fontSize: '0.85rem', 
        color: '#6b7280', 
        padding: '8px 12px', 
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        💡 <strong>快捷键：</strong> 
        输入 <code># 空格</code> 创建标题，
        <code>**文字**</code> 加粗，
        <code>- 空格</code> 列表
      </div>
      <div className="toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'active' : ''}
          title="粗体 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'active' : ''}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'active' : ''}
          title="删除线"
        >
          <s>S</s>
        </button>
        <span className="divider">|</span>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
          title="标题 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          title="标题 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
          title="标题 3"
        >
          H3
        </button>
        <span className="divider">|</span>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'active' : ''}
          title="无序列表"
        >
          • 列表
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'active' : ''}
          title="有序列表"
        >
          1. 列表
        </button>
        <span className="divider">|</span>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'active' : ''}
          title="代码块"
        >
          &lt;/&gt;
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'active' : ''}
          title="引用"
        >
          "
        </button>
        <span className="divider">|</span>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
          title="插入表格"
        >
          📊 表格
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export default RichTextEditor;
