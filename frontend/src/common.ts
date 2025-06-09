import { Card, CardImage, Style } from "./types";
import styles from "./styles.json";

export const suitMap: Record<string, string> = { a: '🪙', b: '⚔️', c: '🏺', d: '🦯' };

export function getCardPath(card: Card, styleName: string): CardImage {
    const style = styles.find((s: Style) => s.name === styleName) as Style;
    if (!style) {
        throw new Error(`Invalid style name: ${styleName}`);
    }

    return {
        src: `${styleName}/${card.number}${card.suit}.png`,
        card,
        style
    };
}
