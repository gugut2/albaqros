// Converts between standard Markdown (.md) and rich editable HTML for live-preview editing

export interface ParsedFrontmatter {
  tags?: string[];
  [key: string]: any;
}

// Parse YAML frontmatter at the top of markdown documents (Obsidian & standard markdown compatible)
export function extractFrontmatter(content: string): {
  frontmatter: ParsedFrontmatter;
  body: string;
  hasFrontmatter: boolean;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, body: content, hasFrontmatter: false };
  }
  const rawFm = match[1];
  const body = content.substring(match[0].length);
  const frontmatter: ParsedFrontmatter = {};

  const lines = rawFm.split('\n');
  let inTags = false;
  const tags: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('tags:')) {
      const rest = trimmed.replace(/^tags:\s*/, '').trim();
      if (rest.startsWith('[') && rest.endsWith(']')) {
        rest
          .slice(1, -1)
          .split(',')
          .forEach((t) => {
            const clean = t.trim().replace(/^['"#]+|['"]+$/g, '').toLowerCase();
            if (clean) tags.push(clean);
          });
        inTags = false;
      } else {
        inTags = true;
      }
    } else if (inTags && trimmed.startsWith('- ')) {
      const clean = trimmed.replace(/^-\s*/, '').replace(/^['"#]+|['"]+$/g, '').toLowerCase();
      if (clean) tags.push(clean);
    } else if (inTags && trimmed.includes(':')) {
      inTags = false;
    }
  }

  if (tags.length > 0) {
    frontmatter.tags = Array.from(new Set(tags)).sort();
  }

  return { frontmatter, body, hasFrontmatter: true };
}

// Prepend or update YAML frontmatter tags at the top of the document
export function attachFrontmatter(body: string, tags?: string[]): string {
  const cleanBody = body.trimStart();
  const validTags = Array.from(
    new Set((tags || []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))
  ).sort();

  if (validTags.length === 0) {
    return cleanBody;
  }

  const tagsYaml = validTags.map((t) => `  - ${t}`).join('\n');
  return `---\ntags:\n${tagsYaml}\n---\n\n${cleanBody}`;
}

// Extract all tags from frontmatter and inline #tag markers across the document
export function extractAllNoteTags(content: string): string[] {
  const { frontmatter, body } = extractFrontmatter(content);
  const tagSet = new Set<string>(frontmatter.tags || []);
  const bodyLines = body.split('\n');
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const matches = line.match(/(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g);
    if (matches) {
      for (const m of matches) {
        const t = m.trim().replace(/^#/, '').toLowerCase();
        if (t && !/^\d+$/.test(t)) {
          tagSet.add(t);
        }
      }
    }
  }
  return Array.from(tagSet).sort();
}

// Add a tag to frontmatter
export function addTagToContent(content: string, newTag: string): string {
  const tag = newTag.trim().toLowerCase().replace(/^#/, '');
  if (!tag) return content;
  const currentTags = extractAllNoteTags(content);
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
  }
  const { body } = extractFrontmatter(content);
  return attachFrontmatter(body, currentTags);
}

// Remove a tag from both frontmatter and inline body occurrences
export function removeTagFromContent(content: string, tagToRemove: string): string {
  const tag = tagToRemove.trim().toLowerCase().replace(/^#/, '');
  if (!tag) return content;
  const { frontmatter, body } = extractFrontmatter(content);
  const updatedFmTags = (frontmatter.tags || []).filter((t) => t !== tag);
  // Remove #tag from body text if present
  const tagRegex = new RegExp(`(^|\\s)#${escapeRegex(tag)}(?=\\s|$|[.,!?;:])`, 'gi');
  const updatedBody = body.replace(tagRegex, '$1');
  return attachFrontmatter(updatedBody, updatedFmTags);
}

// Rename a tag in both frontmatter and inline body occurrences
export function renameTagInContent(content: string, oldTag: string, newTag: string): string {
  const oldT = oldTag.trim().toLowerCase().replace(/^#/, '');
  const newT = newTag.trim().toLowerCase().replace(/^#/, '');
  if (!oldT || !newT || oldT === newT) return content;
  const { frontmatter, body } = extractFrontmatter(content);
  const updatedFmTags = (frontmatter.tags || []).map((t) => (t === oldT ? newT : t));
  const tagRegex = new RegExp(`(^|\\s)#${escapeRegex(oldT)}(?=\\s|$|[.,!?;:])`, 'gi');
  const updatedBody = body.replace(tagRegex, `$1#${newT}`);
  return attachFrontmatter(updatedBody, updatedFmTags);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to sanitize any previously corrupted wikilinks or spilled CSS attributes
export function cleanCorruptedLinks(md: string): string {
  if (!md) return '';
  return md
    .replace(
      /\[\[(.*?)(?:\|[#a-f0-9]+)?\]\];?\s*text-decoration:[^>]*>/gi,
      (_, target) => `[[${target.trim()}]]`
    )
    .replace(/(?:^|\s*)#?[0-9a-f]{6};\s*text-decoration:[^>]*>/gi, '');
}

export function markdownToHtml(md: string): string {
  if (!md) return '<p><br></p>';

  const cleanedMd = cleanCorruptedLinks(md);
  // Strip frontmatter so only clean body content is loaded into the live editor
  const { body } = extractFrontmatter(cleanedMd);
  const lines = body.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code blocks
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      htmlParts.push(
        `<pre class="albaqros-code-block" style="background: #090c13; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; font-family: var(--font-mono); font-size: 0.85rem; color: #e2e8f0; margin: 12px 0; overflow-x: auto;"><code>${codeLines.join('\n')}</code></pre>`
      );
      // Consume trailing single empty line delimiter
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // 2. Headings
    if (trimmed.startsWith('# ')) {
      htmlParts.push(
        `<h1 style="font-size: 1.65rem; font-weight: 800; color: #f8fafc; font-family: var(--font-display); margin: 20px 0 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">${renderInlineToHtml(trimmed.slice(2))}</h1>`
      );
      i++;
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlParts.push(
        `<h2 style="font-size: 1.35rem; font-weight: 700; color: #f8fafc; font-family: var(--font-display); margin: 16px 0 6px;">${renderInlineToHtml(trimmed.slice(3))}</h2>`
      );
      i++;
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlParts.push(
        `<h3 style="font-size: 1.15rem; font-weight: 600; color: #f8fafc; margin: 14px 0 4px;">${renderInlineToHtml(trimmed.slice(4))}</h3>`
      );
      i++;
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      htmlParts.push(
        `<h4 style="font-size: 1.02rem; font-weight: 600; color: #f8fafc; margin: 12px 0 4px;">${renderInlineToHtml(trimmed.slice(5))}</h4>`
      );
      i++;
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // 3. Task checkboxes (- [ ] or - [x])
    const taskMatch = trimmed.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const taskText = taskMatch[2];
      htmlParts.push(
        `<div class="albaqros-task-item" style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">` +
          `<input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor: pointer; accent-color: #10b981; width: 16px; height: 16px; margin: 0;">` +
          `<span class="albaqros-task-text" style="font-size: 0.92rem; color: ${isChecked ? '#64748b' : '#f8fafc'}; ${isChecked ? 'text-decoration: line-through;' : ''}">${renderInlineToHtml(taskText)}</span>` +
        `</div>`
      );
      i++;
      continue;
    }

    // 4. Unordered bullet list (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, '');
        listItems.push(`<li style="margin: 3px 0;">${renderInlineToHtml(itemText)}</li>`);
        i++;
      }
      htmlParts.push(
        `<ul style="margin: 6px 0 6px 20px; padding: 0; font-size: 0.92rem; color: #f8fafc; line-height: 1.6;">${listItems.join('')}</ul>`
      );
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // 5. Blockquote (> )
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      htmlParts.push(
        `<blockquote style="border-left: 3px solid #6366f1; background: rgba(255, 255, 255, 0.03); padding: 8px 14px; margin: 10px 0; color: #cbd5e1; font-style: italic; border-radius: 4px;">${quoteLines.map((ql) => renderInlineToHtml(ql)).join('<br>')}</blockquote>`
      );
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // 6. Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      htmlParts.push(`<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 18px 0;">`);
      i++;
      if (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // 7. Explicit empty line (beyond block separators)
    if (!trimmed) {
      htmlParts.push(`<p><br></p>`);
      i++;
      continue;
    }

    // 8. Regular paragraph
    htmlParts.push(
      `<p style="margin: 6px 0; font-size: 0.94rem; line-height: 1.65; color: #f8fafc;">${renderInlineToHtml(line)}</p>`
    );
    i++;
    if (i < lines.length && lines[i].trim() === '') i++;
  }

  return htmlParts.join('');
}

// Inline formatting using token isolation so wikilinks, tags, code, bold, and italic never collide
function renderInlineToHtml(text: string): string {
  const tokens: string[] = [];
  function addToken(html: string): string {
    tokens.push(html);
    return `\x02TOK_${tokens.length - 1}\x03`;
  }

  let s = cleanCorruptedLinks(text);
  s = escapeHtml(s);

  // 1. Inline code `text`
  s = s.replace(/`([^`]+)`/g, (_, code) => addToken(`<code class="albaqros-inline-code">${code}</code>`));

  // 2. Wikilinks [[Target|Alias]] or [[Target]]
  s = s.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, target, alias) => {
    const cleanTarget = target.trim();
    const display = (alias || cleanTarget).trim();
    return addToken(
      `<span class="albaqros-note-link" data-note-target="${cleanTarget}" title="Open note: ${cleanTarget}">${display}</span>`
    );
  });

  // 3. Tags #tag (ignore pure numbers like #1)
  s = s.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)/g, (fullMatch, space, tag) => {
    if (/^\d+$/.test(tag)) return fullMatch;
    return (space || '') + addToken(`<span class="albaqros-tag" data-tag="${tag}">#${tag}</span>`);
  });

  // 4. Bold **text**
  s = s.replace(/\*\*(.*?)\*\*/g, (_, b) => `<strong>${b}</strong>`);

  // 5. Italic *text*
  s = s.replace(/\*(.*?)\*/g, (_, it) => `<em>${it}</em>`);

  // 6. Strikethrough ~~text~~
  s = s.replace(/~~(.*?)~~/g, (_, d) => `<del>${d}</del>`);

  // Restore tokens in single pass
  s = s.replace(/\x02TOK_(\d+)\x03/g, (_, idx) => tokens[Number(idx)]);
  return s;
}

// Convert HTML from contentEditable back to clean standard Markdown
export function htmlToMarkdown(html: string, tags?: string[]): string {
  if (!html) return attachFrontmatter('', tags);

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const rawMd = processNodeToMarkdown(tempDiv, true);
  const cleaned = cleanCorruptedLinks(rawMd).trim() + '\n';
  return attachFrontmatter(cleaned, tags);
}

function processNodeToMarkdown(node: Node, isTopLevel = false): string {
  let md = '';

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      // At top-level between blocks, ignore whitespace text nodes
      if (isTopLevel && !text.trim()) {
        continue;
      }
      md += text;
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toUpperCase();

      // Check if it's a note link span
      if (el.classList.contains('albaqros-note-link')) {
        let rawTarget = el.getAttribute('data-note-target') || el.innerText.trim();
        let target = rawTarget.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
        let display = el.innerText.trim().replace(/^\[\[/, '').replace(/\]\]$/, '').trim();

        // Sanitize any corrupted CSS snippets in target/display
        if (target.includes('text-decoration') || target.startsWith('#')) {
          target = target.split(';')[0].replace(/^#/, '').trim();
        }
        if (display.includes('text-decoration') || display.startsWith('#')) {
          display = target;
        }

        if (display && display !== target) {
          md += `[[${target}|${display}]]`;
        } else {
          md += `[[${target}]]`;
        }
        continue;
      }

      // Check if it's a task item
      if (el.classList.contains('albaqros-task-item')) {
        const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const isChecked = checkbox ? checkbox.checked : false;
        const textSpan = el.querySelector('.albaqros-task-text') as HTMLElement | null;
        const taskText = textSpan ? processNodeToMarkdown(textSpan).trim() : el.innerText.trim();
        md += `- [${isChecked ? 'x' : ' '}] ${taskText}\n`;
        continue;
      }

      // Check if it's a tag span
      if (el.classList.contains('albaqros-tag')) {
        const tagVal = el.getAttribute('data-tag') || el.innerText.replace(/^#/, '');
        md += `#${tagVal}`;
        continue;
      }

      switch (tag) {
        case 'H1':
          md += `# ${processNodeToMarkdown(el).trim()}\n\n`;
          break;
        case 'H2':
          md += `## ${processNodeToMarkdown(el).trim()}\n\n`;
          break;
        case 'H3':
          md += `### ${processNodeToMarkdown(el).trim()}\n\n`;
          break;
        case 'H4':
        case 'H5':
        case 'H6':
          md += `#### ${processNodeToMarkdown(el).trim()}\n\n`;
          break;
        case 'STRONG':
        case 'B':
          md += `**${processNodeToMarkdown(el)}**`;
          break;
        case 'EM':
        case 'I':
          md += `*${processNodeToMarkdown(el)}*`;
          break;
        case 'DEL':
        case 'S':
        case 'STRIKE':
          md += `~~${processNodeToMarkdown(el)}~~`;
          break;
        case 'CODE':
          if (el.parentElement?.tagName.toUpperCase() === 'PRE') {
            md += el.innerText;
          } else {
            md += `\`${el.innerText}\``;
          }
          break;
        case 'PRE':
          md += `\`\`\`\n${el.innerText.trim()}\n\`\`\`\n\n`;
          break;
        case 'BLOCKQUOTE':
          md += `> ${processNodeToMarkdown(el).trim()}\n\n`;
          break;
        case 'UL':
          for (let j = 0; j < el.children.length; j++) {
            const li = el.children[j];
            if (li.tagName.toUpperCase() === 'LI') {
              md += `- ${processNodeToMarkdown(li).trim()}\n`;
            }
          }
          md += '\n';
          break;
        case 'OL':
          for (let j = 0; j < el.children.length; j++) {
            const li = el.children[j];
            if (li.tagName.toUpperCase() === 'LI') {
              md += `${j + 1}. ${processNodeToMarkdown(li).trim()}\n`;
            }
          }
          md += '\n';
          break;
        case 'LI':
          md += `- ${processNodeToMarkdown(el).trim()}\n`;
          break;
        case 'HR':
          md += `---\n\n`;
          break;
        case 'P':
        case 'DIV':
          const inner = processNodeToMarkdown(el).trim();
          if (inner) {
            md += `${inner}\n\n`;
          } else {
            md += '\n';
          }
          break;
        case 'BR':
          md += '\n';
          break;
        default:
          md += processNodeToMarkdown(el);
          break;
      }
    }
  }

  return md;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
