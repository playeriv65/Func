#!/bin/bash
# Sample deployment script

echo "Starting deployment..."

# Check environment
if [ -z "$ENV" ]; then
    export ENV="development"
fi

echo "Environment: $ENV"
echo "Deployment complete!"
