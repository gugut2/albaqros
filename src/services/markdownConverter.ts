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

// Check if a list item (LI) has no words/content after it
export function isListItemEmpty(li: HTMLElement | null): boolean {
  if (!li) return false;
  // Preserve items containing media, links, inputs, or nested sublists
  if (li.querySelector('img, a, input, ul, ol, [data-note-target], [data-tag]')) {
    return false;
  }
  const raw = (li.textContent || '').replace(/[\u00a0\u200b\r\n\t]/g, ' ').trim();
  if (raw.length > 0) return false;
  return true;
}

// Clean and remove any empty list items in a container
export function cleanAllEmptyListItems(root: HTMLElement, excludeLi?: HTMLElement | null): void {
  const lists = Array.from(root.querySelectorAll('ul, ol')).reverse();
  lists.forEach((list) => {
    const lis = Array.from(list.querySelectorAll(':scope > li'));
    lis.forEach((li) => {
      if (li !== excludeLi && isListItemEmpty(li as HTMLElement)) {
        li.remove();
      }
    });
    if (list.children.length === 0 || list.querySelectorAll('li').length === 0) {
      list.remove();
    }
  });
}

interface ParsedMarkdownListItem {
  type: 'ul' | 'ol';
  level: number;
  text: string;
  numVal?: number;
}

function buildNestedListHtml(items: ParsedMarkdownListItem[]): string {
  if (items.length === 0) return '';

  const rootType = items[0].type;
  const root = document.createElement(rootType);
  if (rootType === 'ol') {
    root.style.margin = '6px 0 6px 24px';
    root.style.padding = '0';
    root.style.fontSize = '0.92rem';
    root.style.color = '#f8fafc';
    root.style.lineHeight = '1.6';
    root.style.listStyleType = 'decimal';
    if (items[0].numVal && items[0].numVal > 1) {
      root.setAttribute('start', String(items[0].numVal));
    }
  } else {
    root.style.margin = '6px 0 6px 20px';
    root.style.padding = '0';
    root.style.fontSize = '0.92rem';
    root.style.color = '#f8fafc';
    root.style.lineHeight = '1.6';
  }

  const stack: { listEl: HTMLElement; level: number; lastLi: HTMLElement | null }[] = [
    { listEl: root, level: 0, lastLi: null },
  ];

  for (const item of items) {
    while (stack.length > 1 && item.level < stack[stack.length - 1].level) {
      stack.pop();
    }

    let current = stack[stack.length - 1];

    if (item.level > current.level && current.lastLi) {
      const subList = document.createElement(item.type);
      subList.style.margin = item.type === 'ol' ? '4px 0 4px 20px' : '4px 0 4px 18px';
      subList.style.padding = '0';
      subList.style.fontSize = '0.92rem';
      subList.style.color = '#f8fafc';
      subList.style.lineHeight = '1.6';
      if (item.type === 'ul') {
        subList.style.listStyleType = item.level === 1 ? 'circle' : 'square';
      } else {
        subList.style.listStyleType = item.level === 1 ? 'lower-alpha' : 'lower-roman';
        if (item.numVal && item.numVal > 1) {
          subList.setAttribute('start', String(item.numVal));
        }
      }
      current.lastLi.appendChild(subList);
      current = { listEl: subList, level: item.level, lastLi: null };
      stack.push(current);
    }

    const li = document.createElement('li');
    li.style.margin = '3px 0';
    li.innerHTML = renderInlineToHtml(item.text);
    current.listEl.appendChild(li);
    current.lastLi = li;
  }

  return root.outerHTML;
}

export function markdownToHtml(md: string): string {
  if (!md) return '<p><br></p>';

  // Sanitize corrupted links while preserving genuine markdown content
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

    // 4. Lists (unordered bullet list - or *, or ordered numbered list 1. or 1), including nested sublists
    const isBulletLine = (str: string) => /^[ \t]*[-*•](\s+.*|\s*)$/.test(str);
    const isNumberedLine = (str: string) => /^[ \t]*\d+[.)](\s+.*|\s*)$/.test(str);
    const isListLine = (str: string) => isBulletLine(str) || isNumberedLine(str);

    if (isListLine(line)) {
      const listItems: ParsedMarkdownListItem[] = [];
      let baseIndent = -1;

      while (i < lines.length) {
        const rawLine = lines[i];
        const curTrim = rawLine.trim();

        if (isListLine(rawLine)) {
          const leadSpaces = rawLine.match(/^([ \t]*)/)?.[1]?.replace(/\t/g, '  ').length || 0;
          if (baseIndent === -1) {
            baseIndent = leadSpaces;
          }
          const relIndent = Math.max(0, leadSpaces - baseIndent);
          const level = Math.floor(relIndent / 2);

          if (isNumberedLine(rawLine)) {
            const numMatch = curTrim.match(/^(\d+)[.)]\s*(.*)$/);
            const numVal = numMatch ? parseInt(numMatch[1], 10) : 1;
            const text = numMatch ? numMatch[2].trim() : '';
            listItems.push({ type: 'ol', level, text, numVal });
          } else {
            const bulletMatch = curTrim.match(/^[-*•]\s*(.*)$/);
            const text = bulletMatch ? bulletMatch[1].trim() : '';
            listItems.push({ type: 'ul', level, text });
          }
          i++;
        } else if (
          curTrim === '' &&
          i + 1 < lines.length &&
          isListLine(lines[i + 1])
        ) {
          // Allow loose list with empty line between list items
          i++;
        } else {
          break;
        }
      }

      if (listItems.length > 0) {
        htmlParts.push(buildNestedListHtml(listItems));
      }
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

  // 3. External Markdown links [Text](URL)
  s = s.replace(/(?<!!)\[(.*?)\]\(([^\s)]+)\)/g, (_, label, rawUrl) => {
    const unescapedUrl = rawUrl.replace(/&amp;/g, '&').trim();
    if (!unescapedUrl) return _;
    const fullUrl = /^(?:https?:\/\/|mailto:)/i.test(unescapedUrl)
      ? unescapedUrl
      : (unescapedUrl.startsWith('www.') ? `https://${unescapedUrl}` : unescapedUrl);
    const display = (label || unescapedUrl).trim();
    return addToken(
      `<a class="albaqros-external-link" href="${fullUrl}" target="_blank" rel="noopener noreferrer" title="${fullUrl}">${display}</a>`
    );
  });

  // 3b. Custom pipe links [URL|Custom Name] or [Custom Name|URL]
  s = s.replace(/(?<!\[)\[([^[\]|\n]+)\|([^[\]\n]+)\](?!\])/g, (fullMatch, part1, part2) => {
    const p1 = part1.trim().replace(/&amp;/g, '&');
    const p2 = part2.trim().replace(/&amp;/g, '&');
    const isP1Url = /^(?:https?:\/\/|www\.|mailto:)/i.test(p1);
    const isP2Url = /^(?:https?:\/\/|www\.|mailto:)/i.test(p2);
    if (!isP1Url && !isP2Url) return fullMatch;
    const rawUrl = isP1Url ? p1 : p2;
    const label = isP1Url ? p2 : p1;
    const fullUrl = /^(?:https?:\/\/|mailto:)/i.test(rawUrl)
      ? rawUrl
      : (rawUrl.startsWith('www.') ? `https://${rawUrl}` : `https://${rawUrl}`);
    const display = label || fullUrl;
    return addToken(
      `<a class="albaqros-external-link" href="${fullUrl}" target="_blank" rel="noopener noreferrer" title="${fullUrl}">${display}</a>`
    );
  });

  // 4. Tags #tag (ignore pure numbers like #1)
  s = s.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)/g, (fullMatch, space, tag) => {
    if (/^\d+$/.test(tag)) return fullMatch;
    return (space || '') + addToken(`<span class="albaqros-tag" data-tag="${tag}">#${tag}</span>`);
  });

  // 5. Bold **text**
  s = s.replace(/\*\*(.*?)\*\*/g, (_, b) => `<strong>${b}</strong>`);

  // 6. Italic *text*
  s = s.replace(/\*(.*?)\*/g, (_, it) => `<em>${it}</em>`);

  // 7. Strikethrough ~~text~~
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

  // Clean empty list items from DOM tree before serializing to markdown
  cleanAllEmptyListItems(tempDiv);

  const rawMd = processNodeToMarkdown(tempDiv, true);
  // Ensure any bullet points or numbered markers with no words after them are purged
  const cleaned = cleanCorruptedLinks(rawMd)
    .replace(/^[-*]\s*$/gm, '')
    .replace(/^\d+[.)]\s*$/gm, '')
    .trim() + '\n';
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

      // Check if it's an external link
      if (tag === 'A' || el.classList.contains('albaqros-external-link')) {
        const href = (el.getAttribute('href') || '').trim();
        const display = processNodeToMarkdown(el).trim();
        if (href) {
          md += `[${display || href}](${href})`;
        } else if (display) {
          md += display;
        }
        continue;
      }

      switch (tag) {
        case 'A': {
          const href = (el.getAttribute('href') || '').trim();
          const display = processNodeToMarkdown(el).trim();
          if (href) {
            md += `[${display || href}](${href})`;
          } else if (display) {
            md += display;
          }
          break;
        }
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
        case 'OL': {
          md += processListToMarkdown(el, 0);
          break;
        }
        case 'LI': {
          let singleLiText = processNodeToMarkdown(el).trim();
          const parentTag = el.parentElement?.tagName.toUpperCase();
          if (parentTag === 'OL') {
            singleLiText = singleLiText.replace(/^\d+[.)]\s*/, '').trim();
            if (singleLiText && singleLiText.replace(/[\u00a0\u200b\s]/g, '').length > 0) {
              md += `1. ${singleLiText}\n`;
            }
          } else {
            singleLiText = singleLiText.replace(/^[-*•]\s*/, '').trim();
            if (singleLiText && singleLiText.replace(/[\u00a0\u200b\s]/g, '').length > 0) {
              md += `- ${singleLiText}\n`;
            }
          }
          break;
        }
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

function processListToMarkdown(listEl: HTMLElement, indentLevel = 0): string {
  const isOl = listEl.tagName.toUpperCase() === 'OL';
  const startAttr = listEl.getAttribute('start');
  let olIndex = startAttr ? parseInt(startAttr, 10) || 1 : 1;
  const indent = '  '.repeat(indentLevel);
  let md = '';

  for (let j = 0; j < listEl.children.length; j++) {
    const child = listEl.children[j] as HTMLElement;
    const tag = child.tagName.toUpperCase();

    if (tag === 'LI') {
      // Find any nested lists inside this <li>
      const nestedLists = Array.from(child.children).filter((c) => {
        const cTag = c.tagName.toUpperCase();
        return cTag === 'UL' || cTag === 'OL';
      }) as HTMLElement[];

      // Clone child LI and remove nested lists to extract only direct LI content
      const liClone = child.cloneNode(true) as HTMLElement;
      Array.from(liClone.children).forEach((c) => {
        const cTag = c.tagName.toUpperCase();
        if (cTag === 'UL' || cTag === 'OL') {
          c.remove();
        }
      });

      let itemText = processNodeToMarkdown(liClone, false).trim();
      if (isOl) {
        itemText = itemText.replace(/^\d+[.)]\s*/, '').trim();
      } else {
        itemText = itemText.replace(/^[-*•]\s*/, '').trim();
      }

      if (itemText && itemText.replace(/[\u00a0\u200b\s]/g, '').length > 0) {
        if (isOl) {
          md += `${indent}${olIndex}. ${itemText}\n`;
          olIndex++;
        } else {
          md += `${indent}- ${itemText}\n`;
        }
      }

      // Process any nested lists inside this <li> with indentLevel + 1
      for (const nestedList of nestedLists) {
        md += processListToMarkdown(nestedList, indentLevel + 1);
      }
    } else if (tag === 'UL' || tag === 'OL') {
      md += processListToMarkdown(child, indentLevel + 1);
    }
  }

  if (indentLevel === 0) {
    md += '\n';
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
