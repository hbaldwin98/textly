# Docker Deployment Guide for Textly

This guide explains how to deploy your Textly application using Docker on various platforms.

## Prerequisites

- Docker and Docker Compose installed
- Your environment variables configured

## Local Development with Docker

1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` file with your actual values:**
   ```bash
   OPENAI_API_KEY=your_actual_openai_api_key
   OPENAI_BASE_URL=https://api.openai.com/v1
   PUBLIC_POCKETBASE_URL=http://localhost:8080
   ```

3. **Run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

4. **Access your application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

## Deployment Options

### Option 1: Fly.io (Recommended)

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io:**
   ```bash
   fly auth login
   ```

3. **Deploy Backend:**
   ```bash
   # Create and deploy backend app
   fly launch --dockerfile Dockerfile.backend --name textly-backend
   
   # Set environment variables
   fly secrets set OPENAI_API_KEY=your_key OPENAI_BASE_URL=https://api.openai.com/v1
   
   # Create persistent volume for database
   fly volumes create pb_data --size 1
   ```

4. **Deploy Frontend:**
   ```bash
   # Create frontend app
   cd web
   fly launch --dockerfile Dockerfile --name textly-frontend
   
   # Set backend URL (replace with your backend URL)
   fly secrets set PUBLIC_POCKETBASE_URL=https://textly-backend.fly.dev
   ```

### Option 2: Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

### Option 3: DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure build settings:
   - Backend: Dockerfile at `Dockerfile.backend`
   - Frontend: Dockerfile at `web/Dockerfile`
3. Set environment variables in the dashboard

### Option 4: Any Docker Platform

You can deploy to any platform that supports Docker by:

1. **Building images:**
   ```bash
   # Build backend
   docker build -t textly-backend ./server
   
   # Build frontend
   docker build -t textly-frontend ./web
   ```

2. **Push to registry:**
   ```bash
   docker tag textly-backend your-registry/textly-backend
   docker tag textly-frontend your-registry/textly-frontend
   docker push your-registry/textly-backend
   docker push your-registry/textly-frontend
   ```

## Environment Variables

### Backend (Go/PocketBase)
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_BASE_URL`: OpenAI API base URL (usually https://api.openai.com/v1)

### Frontend (SvelteKit)
- `PUBLIC_POCKETBASE_URL`: URL of your deployed backend

## Database Persistence

Make sure to configure persistent storage for your PocketBase database:
- The database is stored in `/root/pb_data` in the container
- Use volumes or persistent disks depending on your platform

## Troubleshooting

1. **CORS Issues**: Make sure your backend allows requests from your frontend domain
2. **Environment Variables**: Ensure all required environment variables are set
3. **Database**: Verify that persistent storage is properly configured
4. **Networking**: Check that services can communicate with each other

## Production Considerations

1. **Security**: Use HTTPS in production
2. **Database Backups**: Set up regular backups of your PocketBase data
3. **Monitoring**: Add health checks and monitoring
4. **Scaling**: Consider using load balancers for high traffic 