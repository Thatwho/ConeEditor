/**
 * Remark plugin for parsing wikilinks ([[Target]] and [[Target|Alias]]) in Markdown.
 *
 * This plugin processes text nodes and replaces wikilink patterns with wikilink AST nodes
 * that can be rendered as links or used for indexing purposes.
 *
 * Supports:
 * - [[Target]] - Simple wikilink
 * - [[Target|Alias]] - Wikilink with display alias
 * - Regular Markdown links remain unchanged
 *
 * @module remark-wikilink
 */
import { visit } from 'unist-util-visit';
/**
 * Regular expression to match wikilinks.
 * Matches: [[Target]] or [[Target|Alias]]
 */
const WIKILINK_REGEX = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
/**
 * Parse a text string and extract all wikilinks.
 *
 * @param text - The text to parse
 * @returns Array of wikilink matches with positions
 */
export function parseWikilinks(text) {
    const matches = [];
    let match;
    // Reset regex state
    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(text)) !== null) {
        const [raw, target, , alias] = match;
        matches.push({
            raw,
            target: target.trim(),
            alias: alias?.trim(),
            start: match.index,
            end: match.index + raw.length
        });
    }
    return matches;
}
/**
 * Extract all wikilink targets from markdown text.
 * Utility function for indexing and link analysis.
 *
 * @param markdownText - The markdown text to analyze
 * @returns Array of unique wikilink targets
 */
export function extractWikilinks(markdownText) {
    const links = parseWikilinks(markdownText);
    const targets = new Set(links.map(link => link.target));
    return Array.from(targets);
}
/**
 * Create a wikilink AST node.
 *
 * @param match - The wikilink match
 * @returns WikilinkNode
 */
function createWikilinkNode(match) {
    return {
        type: 'wikilink',
        data: {
            hName: 'a',
            hProperties: {
                'data-wikilink': match.target,
                href: `#/note/${encodeURIComponent(match.target)}`,
                className: ['wikilink']
            },
            target: match.target,
            alias: match.alias
        },
        value: match.raw
    };
}
/**
 * Remark plugin to transform wikilinks in text nodes.
 *
 * This plugin walks the AST and replaces [[Target]] and [[Target|Alias]] patterns
 * with wikilink nodes that can be rendered as clickable links.
 *
 * @returns Transformer function
 */
export default function remarkWikilink() {
    return (tree) => {
        visit(tree, 'text', (node, index, parent) => {
            if (!parent || index === null)
                return;
            const matches = parseWikilinks(node.value);
            if (matches.length === 0)
                return;
            // Split the text node into multiple nodes
            const newNodes = [];
            let currentPos = 0;
            for (const match of matches) {
                // Add text before the wikilink
                if (match.start > currentPos) {
                    const beforeText = node.value.slice(currentPos, match.start);
                    if (beforeText) {
                        newNodes.push({
                            type: 'text',
                            value: beforeText
                        });
                    }
                }
                // Add the wikilink node
                newNodes.push(createWikilinkNode(match));
                currentPos = match.end;
            }
            // Add remaining text after the last wikilink
            if (currentPos < node.value.length) {
                const afterText = node.value.slice(currentPos);
                if (afterText) {
                    newNodes.push({
                        type: 'text',
                        value: afterText
                    });
                }
            }
            // Replace the original text node with the new nodes
            parent.children.splice(index, 1, ...newNodes);
            // Return the index to continue processing (skip the nodes we just added)
            return index + newNodes.length;
        });
    };
}
/**
 * Type guard to check if a node is a wikilink node.
 *
 * @param node - The node to check
 * @returns True if the node is a wikilink node
 */
export function isWikilinkNode(node) {
    return node.type === 'wikilink';
}
/**
 * Get all wikilinks from an AST tree.
 *
 * @param tree - The AST tree to search
 * @returns Array of wikilink targets
 */
export function getWikilinksFromAST(tree) {
    const targets = [];
    visit(tree, 'wikilink', (node) => {
        targets.push(node.data.target);
    });
    return targets;
}
