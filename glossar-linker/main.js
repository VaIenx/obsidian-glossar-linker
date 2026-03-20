'use strict';
const { Plugin, Modal, Notice, Setting } = require('obsidian');

// Parst alle Begriffe aus allen Glossar-Dateien
async function parseGlossaries(app) {
    const glossarFolder = app.vault.getFolderByPath('Glossar');
    if (!glossarFolder) return [];

    const entries = [];
    for (const file of glossarFolder.children) {
        if (!file.path.endsWith('.md')) continue;
        const category = file.basename;
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^>\s*\[!.*?\]\+?\s+(.+)$/);
            if (match) {
                const term = match[1].trim();
                entries.push({ term, category });
            }
        }
    }
    return entries;
}

// Baut einen sicheren Regex der keine bestehenden Links matcht
function buildRegex(term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Kein Match wenn davor [ oder nach dem Begriff ] steht (bereits verlinkt)
    return new RegExp(`(?<!\\[\\[^\\]]*?)(?<![\\[\\w])${escaped}(?![\\]\\w])`, 'g');
}

function buildLink(term, category) {
    const anchor = term.replaceAll(' ', '%20');
    return `[[Glossar/${category}#${anchor}|${term}]]`;
}

// Findet alle Treffer in einem Text mit Kontext
function findMatches(content, term) {
    const regex = buildRegex(term);
    const matches = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
        // Prüfe ob dieser Treffer bereits Teil eines Links ist
        const before = content.slice(0, m.index);
        const openBrackets = (before.match(/\[\[/g) || []).length;
        const closeBrackets = (before.match(/\]\]/g) || []).length;
        if (openBrackets > closeBrackets) continue; // innerhalb eines Links

        const start = Math.max(0, m.index - 50);
        const end = Math.min(content.length, m.index + term.length + 50);
        matches.push({
            index: m.index,
            context: content.slice(start, end).replace(/\n/g, ' '),
            term,
        });
    }
    return matches;
}

class ReviewModal extends Modal {
    constructor(app, results, onDone) {
        super(app);
        this.results = results; // [{ file, term, category, matches, content }]
        this.onDone = onDone;
        this.decisions = {}; // filepath+term -> Set of match indices to link
        this.currentIndex = 0;
    }

    onOpen() {
        this.render();
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();

        if (this.currentIndex >= this.results.length) {
            this.showSummary();
            return;
        }

        const item = this.results[this.currentIndex];
        const key = `${item.file.path}::${item.term}`;
        if (!this.decisions[key]) {
            this.decisions[key] = new Set();
        }

        contentEl.createEl('div', { cls: 'glossar-header' }).createEl('h2', {
            text: `${this.currentIndex + 1} / ${this.results.length} — ${item.file.basename}`
        });

        contentEl.createEl('p', {
            text: `Begriff: "${item.term}" (Glossar: ${item.category})`,
            cls: 'glossar-term'
        });

        const matchContainer = contentEl.createEl('div', { cls: 'glossar-matches' });

        item.matches.forEach((match, i) => {
            const row = matchContainer.createEl('div', { cls: 'glossar-match-row' });

            const cb = row.createEl('input', { type: 'checkbox' });
            cb.checked = this.decisions[key].has(i);
            cb.addEventListener('change', () => {
                if (cb.checked) this.decisions[key].add(i);
                else this.decisions[key].delete(i);
            });

            const ctx = row.createEl('span', { cls: 'glossar-context' });
            const highlighted = match.context.replace(
                new RegExp(match.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                `<mark>${match.term}</mark>`
            );
            ctx.innerHTML = `...${highlighted}...`;
        });

        // Alle / Keine Buttons
        const bulkRow = contentEl.createEl('div', { cls: 'glossar-bulk' });
        const allBtn = bulkRow.createEl('button', { text: '✅ Alle auswählen' });
        allBtn.addEventListener('click', () => {
            item.matches.forEach((_, i) => this.decisions[key].add(i));
            this.render();
        });
        const noneBtn = bulkRow.createEl('button', { text: '⬜ Keine' });
        noneBtn.addEventListener('click', () => {
            this.decisions[key].clear();
            this.render();
        });

        // Navigation
        const navRow = contentEl.createEl('div', { cls: 'glossar-nav' });
        if (this.currentIndex > 0) {
            const backBtn = navRow.createEl('button', { text: '← Zurück' });
            backBtn.addEventListener('click', () => {
                this.currentIndex--;
                this.render();
            });
        }
        const nextBtn = navRow.createEl('button', {
            text: this.currentIndex < this.results.length - 1 ? 'Weiter →' : '✅ Fertig'
        });
        nextBtn.addClass('mod-cta');
        nextBtn.addEventListener('click', () => {
            this.currentIndex++;
            this.render();
        });
    }

    showSummary() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Zusammenfassung' });

        let totalLinks = 0;
        for (const key of Object.keys(this.decisions)) {
            totalLinks += this.decisions[key].size;
        }

        contentEl.createEl('p', { text: `${totalLinks} Verlinkung(en) werden gesetzt.` });

        const confirmBtn = contentEl.createEl('button', { text: '✅ Änderungen speichern' });
        confirmBtn.addClass('mod-cta');
        confirmBtn.addEventListener('click', async () => {
            await this.applyChanges();
            this.close();
        });

        const cancelBtn = contentEl.createEl('button', { text: 'Abbrechen' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    async applyChanges() {
        let totalCount = 0;

        for (const item of this.results) {
            const key = `${item.file.path}::${item.term}`;
            const selectedIndices = this.decisions[key];
            if (!selectedIndices || selectedIndices.size === 0) continue;

            const link = buildLink(item.term, item.category);
            let content = item.content;

            // Von hinten ersetzen damit Indizes stimmen
            const sortedIndices = [...selectedIndices].sort((a, b) => b - a);
            for (const i of sortedIndices) {
                const match = item.matches[i];
                content = content.slice(0, match.index) + link + content.slice(match.index + item.term.length);
                totalCount++;
            }

            await this.app.vault.modify(item.file, content);
        }

        new Notice(`✅ ${totalCount} Verlinkung(en) gesetzt`);
        if (this.onDone) this.onDone();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class GlossarLinkerPlugin extends Plugin {
    async onload() {
        this.addCommand({
            id: 'scan-and-link-glossar',
            name: 'Glossar: Vault scannen und Begriffe verlinken',
            callback: async () => {
                new Notice('🔍 Scanne Vault...');

                const entries = await parseGlossaries(this.app);
                if (entries.length === 0) {
                    new Notice('⚠ Keine Glossar-Einträge gefunden. Ordner "Glossar/" prüfen.');
                    return;
                }

                const files = this.app.vault.getMarkdownFiles().filter(
                    f => !f.path.startsWith('Glossar/')
                );

                const results = [];

                for (const file of files) {
                    const content = await this.app.vault.read(file);
                    for (const { term, category } of entries) {
                        const matches = findMatches(content, term);
                        if (matches.length > 0) {
                            results.push({ file, term, category, matches, content });
                        }
                    }
                }

                if (results.length === 0) {
                    new Notice('✅ Keine unverlinkten Begriffe gefunden.');
                    return;
                }

                new Notice(`📋 ${results.length} Treffer gefunden — Review wird geöffnet`);
                new ReviewModal(this.app, results, null).open();
            }
        });

        // CSS
        const style = document.createElement('style');
        style.textContent = `
            .glossar-header h2 { margin-bottom: 4px; font-size: 16px; }
            .glossar-term { color: var(--text-muted); margin-bottom: 12px; }
            .glossar-matches { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
            .glossar-match-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px; background: var(--background-secondary); border-radius: 6px; }
            .glossar-match-row input[type=checkbox] { margin-top: 3px; flex-shrink: 0; }
            .glossar-context { font-size: 13px; color: var(--text-normal); line-height: 1.5; }
            .glossar-context mark { background: var(--text-highlight-bg); color: var(--text-normal); border-radius: 3px; padding: 0 2px; }
            .glossar-bulk { display: flex; gap: 8px; margin-bottom: 12px; }
            .glossar-nav { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
        `;
        document.head.appendChild(style);
    }
}

module.exports = GlossarLinkerPlugin;
