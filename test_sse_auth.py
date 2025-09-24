#!/usr/bin/env python3
"""Simple test script to verify SSE authentication function."""

from fastapi import Request
from unittest.mock import Mock
from starlette.datastructures import QueryParams, Headers

# Import the function we want to test
from logview.auth import get_current_user_sse

def test_sse_auth():
    print("Testing SSE authentication function...")
    
    # Test 1: Query parameter auth
    print("\n1. Testing query parameter auth:")
    mock_request = Mock(spec=Request)
    mock_request.query_params = QueryParams('user=admin')
    mock_request.headers = Headers({})
    
    try:
        result = get_current_user_sse(mock_request)
        print(f"   Success: {result}")
    except Exception as e:
        print(f"   Error: {e}")
        print(f"   Error detail: {e.detail if hasattr(e, 'detail') else 'N/A'}")
    
    # Test 2: Header auth (fallback)
    print("\n2. Testing header auth:")
    mock_request2 = Mock(spec=Request)
    mock_request2.query_params = QueryParams('')
    mock_request2.headers = Headers({'X-User': 'admin'})
    
    try:
        result = get_current_user_sse(mock_request2)
        print(f"   Success: {result}")
    except Exception as e:
        print(f"   Error: {e}")
        print(f"   Error detail: {e.detail if hasattr(e, 'detail') else 'N/A'}")
    
    # Test 3: No auth (should fail)
    print("\n3. Testing no auth (should fail):")
    mock_request3 = Mock(spec=Request)
    mock_request3.query_params = QueryParams('')
    mock_request3.headers = Headers({})
    
    try:
        result = get_current_user_sse(mock_request3)
        print(f"   Unexpected success: {result}")
    except Exception as e:
        print(f"   Expected error: {e}")
        print(f"   Error detail: {e.detail if hasattr(e, 'detail') else 'N/A'}")

if __name__ == "__main__":
    test_sse_auth()