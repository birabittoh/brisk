# 🃏 Brisk

A multiplayer briscola game.

Huge thanks to [cuperativa](https://github.com/giorgiobornia/cuperativa) for the card images.

## Technology Stack

- **React 18** with TypeScript
- **Socket.IO** for real-time communication
- **Tailwind CSS** for styling

## Setup (local)

1. Install dependencies:
```bash
npm run install
```

2. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:5173`.

You can also build for production:

```bash
npm run build
```

## Setup (docker)

```bash
cp ./frontend/.env.example ./frontend/.env
docker compose up -d --build
```

## License

Brisk is distributed under the MIT license.
