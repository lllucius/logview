#!/usr/bin/env python3
"""Simple test script to demonstrate LogView API functionality."""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, headers=None, description=""):
    """Test an API endpoint and print the results."""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"Endpoint: {endpoint}")
    print(f"Headers: {headers}")
    print('='*60)
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers or {})
        print(f"Status: {response.status_code}")
        
        if response.headers.get('content-type', '').startswith('application/json'):
            print("Response:")
            print(json.dumps(response.json(), indent=2))
        else:
            print("Response (first 500 chars):")
            print(response.text[:500])
    except Exception as e:
        print(f"Error: {e}")

def main():
    """Run API tests."""
    print("LogView API Test Suite")
    print("Make sure the server is running on localhost:8000")
    
    # Basic endpoints
    test_endpoint("/", description="Root endpoint")
    test_endpoint("/health", description="Health check")
    
    # Admin user tests
    admin_headers = {"X-User": "admin"}
    test_endpoint("/user", admin_headers, "Admin user info")
    test_endpoint("/config/groups", admin_headers, "Groups configuration")
    test_endpoint("/files", admin_headers, "List files as admin")
    test_endpoint("/files/auth.log", admin_headers, "Get auth.log content")
    test_endpoint("/files/auth.log?start_line=2&page_size=1", admin_headers, "Get auth.log with pagination")
    
    # Developer user tests
    dev_headers = {"X-User": "developer"}
    test_endpoint("/user", dev_headers, "Developer user info")
    test_endpoint("/files", dev_headers, "List files as developer")
    test_endpoint("/files/app/application.log", dev_headers, "Get application.log as developer")
    
    # Unauthorized access tests
    test_endpoint("/files", description="Unauthorized access (no header)")
    
    unauth_headers = {"X-User": "unauthorized_user"}
    test_endpoint("/files", unauth_headers, "Unauthorized user")
    
    print(f"\n{'='*60}")
    print("API tests completed!")
    print("For real-time file tailing, use:")
    print(f"curl -H 'X-User: admin' {BASE_URL}/files/auth.log/tail")

if __name__ == "__main__":
    main()