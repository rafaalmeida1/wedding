#!/bin/bash

# Production Docker Compose Helper Script
# Usage: ./scripts/prod.sh [command]

set -e

COMPOSE_FILE="docker-compose.production.yml"

case "${1:-help}" in
  up)
    echo "Starting production services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    echo "✓ Services started. Check status with: ./scripts/prod.sh status"
    ;;
  
  down)
    echo "Stopping production services..."
    docker-compose -f "$COMPOSE_FILE" down
    echo "✓ Services stopped"
    ;;
  
  restart)
    echo "Restarting production services..."
    docker-compose -f "$COMPOSE_FILE" restart
    echo "✓ Services restarted"
    ;;
  
  status)
    docker-compose -f "$COMPOSE_FILE" ps
    ;;
  
  logs)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      docker-compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
    else
      docker-compose -f "$COMPOSE_FILE" logs -f
    fi
    ;;
  
  build)
    echo "Building images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    echo "✓ Build complete"
    ;;
  
  rebuild)
    echo "Rebuilding and restarting..."
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    docker-compose -f "$COMPOSE_FILE" up -d
    echo "✓ Rebuild complete. Services restarted"
    ;;
  
  health)
    echo "Checking service health..."
    docker-compose -f "$COMPOSE_FILE" ps | grep -E "(api|workers)"
    echo ""
    echo "Checking API health (port 8887):"
    curl -s http://localhost:8887/health | jq . || echo "API not responding"
    ;;
  
  shell)
    SERVICE="${2:-api}"
    docker-compose -f "$COMPOSE_FILE" exec "$SERVICE" /bin/sh
    ;;
  
  scale-workers)
    REPLICAS="${2:-3}"
    echo "Scaling workers to $REPLICAS replicas..."
    docker-compose -f "$COMPOSE_FILE" up -d --scale workers="$REPLICAS"
    echo "✓ Workers scaled"
    ;;
  
  *)
    echo "Production Docker Compose Helper"
    echo ""
    echo "Usage: ./scripts/prod.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up                - Start all services"
    echo "  down              - Stop all services"
    echo "  restart           - Restart all services"
    echo "  status            - Show service status"
    echo "  logs [service]    - Show logs (api, workers)"
    echo "  build             - Build images"
    echo "  rebuild           - Rebuild images and restart"
    echo "  health            - Check health of services"
    echo "  shell [service]   - Open shell in container (default: api)"
    echo "  scale-workers N   - Scale workers to N replicas"
    echo ""
    echo "Examples:"
    echo "  ./scripts/prod.sh up"
    echo "  ./scripts/prod.sh logs api"
    echo "  ./scripts/prod.sh scale-workers 5"
    exit 0
    ;;
esac
