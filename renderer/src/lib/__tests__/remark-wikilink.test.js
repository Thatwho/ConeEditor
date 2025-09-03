/**
 * Tests for remark-wikilink plugin
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkWikilink, { parseWikilinks, extractWikilinks, getWikilinksFromAST } from '../remark-wikilink';
describe('parseWikilinks', () => {
    it('should parse simple wikilinks', () => {
        const text = 'This is a [[Simple Link]] in text.';
        const links = parseWikilinks(text);
        expect(links).toHaveLength(1);
        expect(links[0]).toEqual({
            raw: '[[Simple Link]]',
            target: 'Simple Link',
            alias: undefined,
            start: 10,
            end: 25
        });
    });
    it('should parse wikilinks with aliases', () => {
        const text = 'Check out [[Target Page|Custom Alias]] for more info.';
        const links = parseWikilinks(text);
        expect(links).toHaveLength(1);
        expect(links[0]).toEqual({
            raw: '[[Target Page|Custom Alias]]',
            target: 'Target Page',
            alias: 'Custom Alias',
            start: 10,
            end: 38
        });
    });
    it('should parse multiple wikilinks', () => {
        const text = 'See [[Page One]] and [[Page Two|Two]] for details.';
        const links = parseWikilinks(text);
        expect(links).toHaveLength(2);
        expect(links[0].target).toBe('Page One');
        expect(links[1].target).toBe('Page Two');
        expect(links[1].alias).toBe('Two');
    });
    it('should handle empty input', () => {
        const links = parseWikilinks('');
        expect(links).toHaveLength(0);
    });
    it('should ignore malformed links', () => {
        const text = 'This has [[incomplete and [not a link] and [[valid]]';
        const links = parseWikilinks(text);
        expect(links).toHaveLength(1);
        expect(links[0].target).toBe('valid');
    });
    it('should trim whitespace from target and alias', () => {
        const text = 'Link with [[ spaced target | spaced alias ]]';
        const links = parseWikilinks(text);
        expect(links).toHaveLength(1);
        expect(links[0].target).toBe('spaced target');
        expect(links[0].alias).toBe('spaced alias');
    });
});
describe('extractWikilinks', () => {
    it('should extract unique targets from markdown', () => {
        const markdown = `
# Title

This page references [[Page A]] and [[Page B|B]].
Later it mentions [[Page A]] again and [[Page C]].
`;
        const targets = extractWikilinks(markdown);
        expect(targets).toHaveLength(3);
        expect(targets).toContain('Page A');
        expect(targets).toContain('Page B');
        expect(targets).toContain('Page C');
    });
    it('should return empty array for no links', () => {
        const markdown = 'Just some regular markdown text.';
        const targets = extractWikilinks(markdown);
        expect(targets).toHaveLength(0);
    });
});
describe('remark-wikilink plugin', () => {
    const processor = unified()
        .use(remarkParse)
        .use(remarkWikilink);
    it('should transform wikilinks in AST', () => {
        const markdown = 'Text with [[Test Link]] inside.';
        const tree = processor.parse(markdown);
        processor.runSync(tree);
        const links = getWikilinksFromAST(tree);
        expect(links).toContain('Test Link');
    });
    it('should handle multiple wikilinks', () => {
        const markdown = 'Multiple [[Link One]] and [[Link Two|Display]] links.';
        const tree = processor.parse(markdown);
        processor.runSync(tree);
        const links = getWikilinksFromAST(tree);
        expect(links).toHaveLength(2);
        expect(links).toContain('Link One');
        expect(links).toContain('Link Two');
    });
    it('should preserve regular text', () => {
        const markdown = 'Regular text without links.';
        const tree = processor.parse(markdown);
        processor.runSync(tree);
        const links = getWikilinksFromAST(tree);
        expect(links).toHaveLength(0);
    });
});
