# Galactic Arcade Multiplayer Server

A WebSocket server for the Galactic Arcade multiplayer game.

## Endpoints

- `GET /health` - Health check
- `GET /game-state` - Current game state

## WebSocket Events

- `playerJoin` - Player joins the game
- `playerMove` - Player moves
- `toggleDoor` - Toggle door state
- `arcadeMachineTransparency` - Arcade machine transparency

## Development

```bash
npm install
npm run dev
```
```

## **Step 4: Install Dependencies**

```bash
npm install
```

## **Step 5: Test Locally**

```bash
npm run dev
```

You should see the server start successfully.

## **Step 6: Push to GitHub**

```bash
git add .
git commit -m "Initial server setup"
git push origin main
```

## **Step 7: Now Go Back to Render**

Now your GitHub repository will have the files, and you can:
1. Go back to Render
2. Create a new **Web Service**
3. Connect to your `galactic-arcade-server` repository
4. Deploy!

The repository structure should look like this: