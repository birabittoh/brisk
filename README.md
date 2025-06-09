# 🃏 Brisk

A multiplayer briscola game.

## Technology Stack

- **React 18** with TypeScript
- **Socket.IO** for real-time communication
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
cp ./frontend/.env.example ./frontend/.env
docker compose up -d
```

## License

Brisk is distributed under the MIT license.
