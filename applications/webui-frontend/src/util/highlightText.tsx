import React from "react";

export function highlightText(text: string, query: string): React.ReactNode {
    if (!query.trim()) {
        return text;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let currentIndex = lowerText.indexOf(lowerQuery);
    let keyCounter = 0;

    while (currentIndex !== -1) {
        if (currentIndex > lastIndex) {
            parts.push(text.slice(lastIndex, currentIndex));
        }

        parts.push(
            React.createElement(
                "mark",
                {
                    key: `highlight-${keyCounter}`,
                    className: "bg-warning-200 text-warning-800 rounded px-0.5"
                },
                text.slice(currentIndex, currentIndex + query.length)
            )
        );

        keyCounter++;
        lastIndex = currentIndex + query.length;
        currentIndex = lowerText.indexOf(lowerQuery, lastIndex);
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

export function highlightTextByTokens(text: string, rawQuery: string): React.ReactNode {
    const tokens = rawQuery
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

    if (tokens.length === 0) {
        return text;
    }

    const lowerText = text.toLowerCase();
    const lowerTokens = tokens.map(t => t.toLowerCase());

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let keyCounter = 0;

    while (cursor < text.length) {
        let bestIndex = -1;
        let bestTokenIndex = -1;
        let bestTokenLength = 0;

        for (let i = 0; i < lowerTokens.length; i++) {
            const t = lowerTokens[i];

            if (!t) continue;

            const idx = lowerText.indexOf(t, cursor);

            if (idx === -1) continue;

            if (bestIndex === -1 || idx < bestIndex || (idx === bestIndex && t.length > bestTokenLength)) {
                bestIndex = idx;
                bestTokenIndex = i;
                bestTokenLength = t.length;
            }
        }

        if (bestIndex === -1) {
            parts.push(text.slice(cursor));
            break;
        }

        if (bestIndex > cursor) {
            parts.push(text.slice(cursor, bestIndex));
        }

        const originalToken = tokens[bestTokenIndex];

        parts.push(
            React.createElement(
                "mark",
                {
                    key: `highlight-token-${keyCounter}`,
                    className: "bg-warning-200 text-warning-800 rounded px-0.5"
                },
                text.slice(bestIndex, bestIndex + originalToken.length)
            )
        );

        keyCounter++;
        cursor = bestIndex + originalToken.length;
    }

    return parts.length > 0 ? parts : text;
}
