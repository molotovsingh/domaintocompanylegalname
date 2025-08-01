
#!/usr/bin/env python3
"""
Test FastAPI Integration - Validate Export Functionality
"""
import requests
import json

BASE_URL = "http://0.0.0.0:8000"

def test_shell_analysis():
    """Test shell.com analysis endpoint"""
    print("Testing Shell.com Analysis...")
    response = requests.get(f"{BASE_URL}/analytics/shell-analysis")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Found {len(data['lei_candidates'])} LEI candidates for shell.com")
        print(f"✓ Geographic intelligence: {data['geographic_intelligence']}")
        print(f"✓ Analysis: {data['analysis']['total_candidates']} total candidates")
        return True
    else:
        print(f"✗ Shell analysis failed: {response.status_code}")
        return False

def test_batch_export(batch_id="test_batch"):
    """Test batch export functionality"""
    print(f"Testing Batch Export for {batch_id}...")
    response = requests.get(f"{BASE_URL}/export/{batch_id}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Export successful: {len(data)} domains")
        if data:
            sample = data[0]
            print(f"✓ Sample domain: {sample['domain']}")
            print(f"✓ GLEIF candidates: {sample['gleif_candidate_count']}")
        return True
    elif response.status_code == 404:
        print(f"✗ Batch {batch_id} not found")
        return False
    else:
        print(f"✗ Export failed: {response.status_code}")
        return False

def test_health():
    """Test health endpoint"""
    print("Testing Health Endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Service healthy: {data['status']}")
        print(f"✓ Features: {', '.join(data['features'])}")
        return True
    else:
        print(f"✗ Health check failed: {response.status_code}")
        return False

if __name__ == "__main__":
    print("FastAPI Integration Test Suite")
    print("=" * 40)
    
    tests = [
        test_health,
        test_shell_analysis,
        lambda: test_batch_export("your_actual_batch_id_here")
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            results.append(False)
        print()
    
    passed = sum(results)
    total = len(results)
    print(f"Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! FastAPI integration is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
