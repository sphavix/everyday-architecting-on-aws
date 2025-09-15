#!/bin/bash
mkdir -p lambda-layers/pillow/python
cd lambda-layers/pillow

# Install Pillow directly to the target directory without virtual environment
pip install Pillow==9.5.0 -t python/

# Clean up
find python -name "*.pyc" -delete
find python -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "Layer built in lambda-layers/pillow/"