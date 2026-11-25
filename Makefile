
.PHONY: up down

# Build and start all services
up:
	docker compose up --build -d

# Stop and remove containers
down:
	docker compose down
