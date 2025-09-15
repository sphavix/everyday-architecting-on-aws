FROM public.ecr.aws/lambda/python:3.9

# Install system dependencies required by Pillow
RUN yum install -y \
    gcc \
    make \
    zlib-devel \
    libjpeg-devel \
    && yum clean all

# Create the layer directory structure
RUN mkdir -p /asset-output/python

# Copy requirements and install
COPY requirements.txt /tmp/
RUN pip install -r /tmp/requirements.txt -t /asset-output/python --no-cache-dir

# Clean up to reduce layer size
RUN find /asset-output/python -name "*.pyc" -delete && \
    find /asset-output/python -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true