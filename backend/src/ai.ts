import { getCardValue } from "./gameManager";
import { Card, GameState, Player, Suit } from "./types"; // Assuming Suit is also exported from types

// Helper function to find the lowest value card in a hand
function getLowestCardInHand(hand: Card[]): Card {
    if (hand.length === 0) {
        throw new Error("Cannot get lowest card from an empty hand.");
    }
    return hand.reduce((min, c) => getCardValue(c) < getCardValue(min) ? c : min);
}

export function computeChosenCard(gameState: GameState, currentPlayer: Player): Card {
    const briscolaSuit = gameState.lastCard?.suit; // This is the suit of the Briscola card under the deck
    const playedCardsInTrick = gameState.playedCards || []; // Cards played in the current trick
    const firstCardPlayed = playedCardsInTrick[0]?.card;
    const dominantSuitInTrick = firstCardPlayed?.suit; // The suit that must be followed

    if (!currentPlayer.hand || currentPlayer.hand.length === 0) {
        throw new Error("Current player has no hand or an empty hand.");
    }

    const currentHand = currentPlayer.hand;

    // Scenario 1: Player is the first to play in the trick
    if (!firstCardPlayed) {
        // Prioritize playing a low-value non-briscola card
        const nonBriscolaCards = currentHand.filter(c => c.suit !== briscolaSuit);
        if (nonBriscolaCards.length > 0) {
            return getLowestCardInHand(nonBriscolaCards);
        }
        // If only briscola cards are in hand, play the lowest briscola
        return getLowestCardInHand(currentHand);
    }

    // Scenario 2: Cards have been played in the trick
    const isBriscolaPlayedInTrick = playedCardsInTrick.some(pc => pc.card.suit === briscolaSuit);
    const highestCardInTrick = playedCardsInTrick.reduce((highest, pc) => {
        const currentCard = pc.card;
        // Determine the "winning" suit for comparison
        let currentWinningSuit: Suit;
        if (isBriscolaPlayedInTrick) {
            currentWinningSuit = briscolaSuit!; // If briscola is played, briscola is the winning suit
        } else {
            currentWinningSuit = dominantSuitInTrick!; // Otherwise, the dominant suit is winning
        }

        // Compare based on suit hierarchy (briscola > dominant > others)
        if (currentCard.suit === currentWinningSuit && highest.card.suit !== currentWinningSuit) {
            return pc; // Current card is of winning suit, highest is not
        } else if (currentCard.suit === currentWinningSuit && highest.card.suit === currentWinningSuit) {
            return getCardValue(currentCard) > getCardValue(highest.card) ? pc : highest;
        } else {
            return highest; // Current card is not of winning suit
        }
    }, playedCardsInTrick[0]); // Start with the first card played as the initial highest

    const currentTrickValue = playedCardsInTrick.reduce((sum, pc) => sum + getCardValue(pc.card), 0);

    // Try to follow suit if possible
    const playableSameSuitCards = currentHand.filter(c => c.suit === dominantSuitInTrick);

    // Filter cards that can beat the current highest card played
    const cardsToBeatHighest: Card[] = currentHand.filter(c => {
        // If briscola has been played, only briscolas can beat it
        if (isBriscolaPlayedInTrick) {
            return c.suit === briscolaSuit && getCardValue(c) > getCardValue(highestCardInTrick.card);
        } else {
            // If no briscola played, can beat with same suit or briscola
            return (c.suit === dominantSuitInTrick && getCardValue(c) > getCardValue(highestCardInTrick.card)) ||
                   (c.suit === briscolaSuit);
        }
    });

    // Strategy 1: Try to win the trick
    // Consider winning if the trick is valuable or if you have a cheap winning card
    const WINNING_THRESHOLD = 10; // Adjust this value based on desired aggression/risk
    if (currentTrickValue >= WINNING_THRESHOLD || cardsToBeatHighest.length > 0) {
        // Prioritize winning with a same-suit card if possible and if it beats the current highest
        const potentialSameSuitWinners = playableSameSuitCards.filter(c => getCardValue(c) > getCardValue(highestCardInTrick.card));
        if (potentialSameSuitWinners.length > 0) {
            // Play the smallest same-suit card that wins
            return getLowestCardInHand(potentialSameSuitWinners);
        }

        // If no same-suit winner, consider briscola cards if allowed (and if they win)
        const briscolaCardsInHand = currentHand.filter(c => c.suit === briscolaSuit);
        if (briscolaCardsInHand.length > 0) {
            const potentialBriscolaWinners = briscolaCardsInHand.filter(c => {
                if (isBriscolaPlayedInTrick) {
                    return getCardValue(c) > getCardValue(highestCardInTrick.card);
                }
                return true; // Any briscola wins if no briscola has been played yet
            });

            if (potentialBriscolaWinners.length > 0) {
                // Play the smallest briscola card that wins
                return getLowestCardInHand(potentialBriscolaWinners);
            }
        }
    }

    // Strategy 2: If we can't or don't want to win, try to lose cheaply
    // If we can follow suit but can't win, play the lowest of that suit
    if (playableSameSuitCards.length > 0) {
        return getLowestCardInHand(playableSameSuitCards);
    }

    // If we cannot follow suit, play the lowest value card in hand (discarding)
    return getLowestCardInHand(currentHand);
}
