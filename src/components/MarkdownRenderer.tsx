import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Bookmark, CheckSquare, Square } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onWikilinkClick: (targetTitle: string) => void;
  onTagClick?: (tag: string) => void;
  onCheckboxToggle?: (lineIndex: number, nextChecked: boolean) => void;
  existingNoteTitles?: string[];
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onWikilinkClick,
  onTagClick,
  onCheckboxToggle,
  existingNoteTitles = [],
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render inline elements (bold, italic, code, wikilinks, tags, links)
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex matching:
    // 1: Wikilinks [[Target|Alias]] or [[Target]]
    // 2: Inline code `code`
    // 3: Bold **bold**
    // 4: Italic *italic*
    // 5: Strikethrough ~~strike~~
    // 6: Markdown link [text](url)
    // 7: Tag #tag
    const pattern = /(\[\[.*?\]\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[.*?\]\(.*?\)|\B#[a-zA-Z0-9_\-\/]+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matchStr = match[0];

      if (matchStr.startsWith('[[') && matchStr.endsWith(']]')) {
        // Wikilink
        const inner = matchStr.slice(2, -2);
        const [targetRaw, aliasRaw] = inner.split('|');
        const target = targetRaw.trim();
        const display = (aliasRaw || target).trim();
        const exists = existingNoteTitles.some(
          (t) => t.toLowerCase() === target.toLowerCase()
        );

        parts.push(
          <button
            key={`wiki-${match.index}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWikilinkClick(target);
            }}
            title={exists ? `Open note: ${target}` : `Create new note: ${target}`}
            style={{
              display: 'inline',
              padding: '0 2px',
              margin: '0 1px',
              border: 'none',
              background: 'transparent',
              color: '#60a5fa',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              fontSize: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              verticalAlign: 'baseline',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#60a5fa';
            }}
          >
            {display}
          </button>
        );
      } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
        // Inline code
        parts.push(
          <code
            key={`code-${match.index}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85em',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#38bdf8',
              padding: '2px 5px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {matchStr.slice(1, -1)}
          </code>
        );
      } else if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        // Bold
        parts.push(
          <strong key={`bold-${match.index}`} style={{ fontWeight: 700, color: '#ffffff' }}>
            {matchStr.slice(2, -2)}
          </strong>
        );
      } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
        // Italic
        parts.push(
          <em key={`italic-${match.index}`} style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
            {matchStr.slice(1, -1)}
          </em>
        );
      } else if (matchStr.startsWith('~~') && matchStr.endsWith('~~')) {
        // Strikethrough
        parts.push(
          <del key={`del-${match.index}`} style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
            {matchStr.slice(2, -2)}
          </del>
        );
      } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
        // Link [text](url)
        const linkMatch = matchStr.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          parts.push(
            <a
              key={`link-${match.index}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#38bdf8',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {linkMatch[1]}
              <ExternalLink size={10} style={{ display: 'inline' }} />
            </a>
          );
        } else {
          parts.push(matchStr);
        }
      } else if (matchStr.startsWith('#')) {
        // Tag
        const tag = matchStr.slice(1);
        parts.push(
          <button
            key={`tag-${match.index}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onTagClick) onTagClick(tag);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 6px',
              margin: '0 2px',
              borderRadius: '999px',
              fontSize: '0.8em',
              fontWeight: 600,
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              cursor: onTagClick ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
          >
            #{tag}
          </button>
        );
      } else {
        parts.push(matchStr);
      }

      lastIndex = match.index + matchStr.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Block-level parser
  const lines = content.split('\n');
  const renderedBlocks: React.ReactNode[] = [];

  let i = 0;
  let codeBlockCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code block ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip ending ```

      const fullCode = codeLines.join('\n');
      const blockId = codeBlockCounter++;
      const isCopied = copiedIndex === blockId;

      renderedBlocks.push(
        <div
          key={`code-block-${i}`}
          style={{
            margin: '14px 0',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: '#0a0d14',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>{lang || 'text'}</span>
            <button
              type="button"
              onClick={() => handleCopyCode(fullCode, blockId)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: isCopied ? '#10b981' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.72rem',
              }}
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              {isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px 14px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              userSelect: 'text',
            }}
          >
            <code>{fullCode}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Horizontal Rule --- or ***
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      renderedBlocks.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-medium)',
            margin: '18px 0',
          }}
        />
      );
      i++;
      continue;
    }

    // 3. Headings
    if (trimmed.startsWith('# ')) {
      renderedBlocks.push(
        <h1
          key={`h1-${i}`}
          style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '20px 0 10px',
            lineHeight: 1.3,
            fontFamily: 'var(--font-display)',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '6px',
          }}
        >
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      renderedBlocks.push(
        <h2
          key={`h2-${i}`}
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '18px 0 8px',
            lineHeight: 1.3,
            fontFamily: 'var(--font-display)',
          }}
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      renderedBlocks.push(
        <h3
          key={`h3-${i}`}
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '14px 0 6px',
            lineHeight: 1.4,
          }}
        >
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      renderedBlocks.push(
        <h4
          key={`h4-${i}`}
          style={{
            fontSize: '0.98rem',
            fontWeight: 600,
            color: '#cbd5e1',
            margin: '12px 0 4px',
          }}
        >
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // 4. Callout blockquotes > [!NOTE], > [!TIP], > [!WARNING], > Quote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }

      const firstLine = quoteLines[0] || '';
      let calloutType: 'note' | 'tip' | 'warning' | 'important' | null = null;
      let calloutBody = quoteLines;

      if (firstLine.startsWith('[!NOTE]')) {
        calloutType = 'note';
        calloutBody = quoteLines.slice(1);
      } else if (firstLine.startsWith('[!TIP]')) {
        calloutType = 'tip';
        calloutBody = quoteLines.slice(1);
      } else if (firstLine.startsWith('[!WARNING]') || firstLine.startsWith('[!CAUTION]')) {
        calloutType = 'warning';
        calloutBody = quoteLines.slice(1);
      } else if (firstLine.startsWith('[!IMPORTANT]')) {
        calloutType = 'important';
        calloutBody = quoteLines.slice(1);
      }

      if (calloutType) {
        const colors = {
          note: { bg: 'rgba(56, 189, 248, 0.08)', border: '#38bdf8', title: 'NOTE' },
          tip: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', title: 'TIP' },
          warning: { bg: 'rgba(244, 63, 94, 0.08)', border: '#f43f5e', title: 'WARNING' },
          important: { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', title: 'IMPORTANT' },
        }[calloutType];

        renderedBlocks.push(
          <div
            key={`callout-${i}`}
            style={{
              margin: '14px 0',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: colors.bg,
              borderLeft: `4px solid ${colors.border}`,
              fontSize: '0.88rem',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.72rem',
                color: colors.border,
                marginBottom: '4px',
                letterSpacing: '0.05em',
              }}
            >
              {colors.title}
            </div>
            {calloutBody.map((qLine, qIdx) => (
              <p key={qIdx} style={{ margin: '2px 0', color: '#e2e8f0', lineHeight: 1.5 }}>
                {renderInline(qLine)}
              </p>
            ))}
          </div>
        );
      } else {
        renderedBlocks.push(
          <blockquote
            key={`quote-${i}`}
            style={{
              margin: '12px 0',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderLeft: '3px solid var(--accent-indigo)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
            }}
          >
            {quoteLines.map((qLine, qIdx) => (
              <p key={qIdx} style={{ margin: '2px 0', lineHeight: 1.5 }}>
                {renderInline(qLine)}
              </p>
            ))}
          </blockquote>
        );
      }
      continue;
    }

    // 5. Checklist task items (- [ ] or - [x])
    const checkboxMatch = trimmed.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (checkboxMatch) {
      const isChecked = checkboxMatch[1].toLowerCase() === 'x';
      const taskText = checkboxMatch[2];
      const currentLineIndex = i;

      renderedBlocks.push(
        <div
          key={`check-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '5px 0',
            fontSize: '0.92rem',
            color: isChecked ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: isChecked ? 'line-through' : 'none',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (onCheckboxToggle) {
                onCheckboxToggle(currentLineIndex, !isChecked);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px',
              cursor: onCheckboxToggle ? 'pointer' : 'default',
              color: isChecked ? '#10b981' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
          <span style={{ lineHeight: 1.5 }}>{renderInline(taskText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 6. Unordered lists (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: { text: string; indent: number }[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const rawLine = lines[i];
        const indent = rawLine.search(/\S/);
        listItems.push({
          text: rawLine.trim().slice(2),
          indent,
        });
        i++;
      }

      renderedBlocks.push(
        <ul
          key={`ul-${i}`}
          style={{
            margin: '8px 0 8px 20px',
            padding: 0,
            fontSize: '0.92rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginLeft: `${item.indent * 4}px`, margin: '3px 0' }}>
              {renderInline(item.text)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Ordered lists (1. 2.)
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }

      renderedBlocks.push(
        <ol
          key={`ol-${i}`}
          style={{
            margin: '8px 0 8px 24px',
            padding: 0,
            fontSize: '0.92rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ margin: '3px 0' }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. Empty lines
    if (!trimmed) {
      renderedBlocks.push(<div key={`empty-${i}`} style={{ height: '10px' }} />);
      i++;
      continue;
    }

    // 9. Regular paragraph
    renderedBlocks.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '6px 0',
          fontSize: '0.92rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
        }}
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div
      style={{
        fontFamily: 'var(--font-main)',
        color: 'var(--text-primary)',
        userSelect: 'text',
      }}
    >
      {renderedBlocks}
    </div>
  );
};
