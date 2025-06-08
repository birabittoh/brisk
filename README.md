# 🎲 Brisk - Frontend

A responsive React frontend for the Brisk multiplayer dice game.

## Features

- **Landing Page**: Create or join games with Italian soccer player names
- **Lobby System**: Real-time player management with host controls
- **Game Interface**: Interactive dice rolling with live updates
- **Chat System**: Real-time messaging during gameplay
- **Responsive Design**: Works seamlessly on desktop and mobile
- **WebSocket Integration**: Real-time communication with the backend

## Technology Stack

- **React 18** with TypeScript
- **Socket.IO Client** for real-time communication
- **Tailwind CSS** for styling

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend server running on port 5000

### Installation

1. Install dependencies:
```bash
npm run install
```

2. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

## Docker Setup

### Build and run with Docker:

```bash
# Run the entire application stack
docker compose up -d
```

## Game Flow

1. **Landing**: Players enter their name and create/join lobbies
2. **Lobby**: Players wait for the host to start the game
3. **Game**: Players take turns rolling dice to earn points
4. **End**: Winners are announced and players return to lobby

## License

Brisk is distributed under the MIT license.
