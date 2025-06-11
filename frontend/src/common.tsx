import { Card, Style, Suit } from "./types";
import styles from "./styles.json";

export const suitMap: Record<Suit, string> = { a: '🪙', b: '⚔️', c: '🏺', d: '🦯' };
export const cardBacks: Card[] = [
    { number: 1, suit: 'a' },
    { number: 1, suit: 'b' },
    { number: 1, suit: 'c' },
    { number: 1, suit: 'd' }
];

const base = import.meta.env.VITE_CARD_IMAGE_BASE || "";
const suitNames: Record<string, string> = { a: 'denari', b: 'spade', c: 'coppe', d: 'bastoni' };
const cardNames: Record<number, string> = {
    1: 'ace',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'queen',
    9: 'knight',
    10: 'king'
};

export const getAltText = (card: Card) => {
    const cardNumber = cardNames[card.number] || card.number.toString();
    const suitName = suitNames[card.suit] || card.suit;
    const suitEmoji = suitMap[card.suit] || card.suit;
    return `${cardNumber} of ${suitName} ${suitEmoji}`;
}

export const renderCardBack = (index: number = 0, className: string = "max-h-[125px] h-auto w-auto inline-block object-contain") => {
    return renderCardImage(cardBacks[index], "backs", className);
}

export const renderCardImage = (card: Card, cardStyle: string, className: string = "max-h-[125px] h-auto w-auto inline-block object-contain") => {
    const style = styles.find((s: Style) => s.name === cardStyle) as Style;
    if (!style) {
        throw new Error(`Invalid style name: ${cardStyle}`);
    }

    const src = `${base}/res/${cardStyle}/${card.number}${card.suit}.png`;

    return (
        <img
            src={src}
            alt={getAltText(card)}
            className={`${className}`}
            draggable="false"
        />
    );
  };
