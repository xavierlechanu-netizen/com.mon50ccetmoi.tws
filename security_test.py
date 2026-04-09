#!/usr/bin/env python3
"""
Additional security and edge case tests for Mon 50cc et moi API
"""

import requests
import json
import time
from datetime import datetime

BACKEND_URL = "https://fifty-cc.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}=== {test_name} ==={Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

class SecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        
    def test_duplicate_registration(self):
        """Test duplicate email registration"""
        print_test_header("Duplicate Registration Prevention")
        
        # First registration
        timestamp = int(time.time())
        test_email = f"duplicate{timestamp}@test.com"
        
        register_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test User"
        }
        
        try:
            # First registration should succeed
            response1 = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            if response1.status_code == 200:
                print_success("First registration successful")
                
                # Second registration with same email should fail
                response2 = self.session.post(f"{API_BASE}/auth/register", json=register_data)
                if response2.status_code == 400:
                    print_success("Duplicate registration correctly prevented")
                else:
                    print_error(f"Expected 400, got {response2.status_code}")
            else:
                print_error(f"First registration failed: {response1.status_code}")
        except Exception as e:
            print_error(f"Test failed: {str(e)}")

    def test_invalid_login_credentials(self):
        """Test login with invalid credentials"""
        print_test_header("Invalid Login Credentials")
        
        # Test with non-existent email
        login_data = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 401:
                print_success("Invalid email correctly rejected")
            else:
                print_error(f"Expected 401, got {response.status_code}")
        except Exception as e:
            print_error(f"Test failed: {str(e)}")
        
        # Test with valid email but wrong password
        login_data = {
            "email": "admin@mon50cc.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 401:
                print_success("Wrong password correctly rejected")
            else:
                print_error(f"Expected 401, got {response.status_code}")
        except Exception as e:
            print_error(f"Test failed: {str(e)}")

    def test_invalid_signal_data(self):
        """Test signal creation with invalid data"""
        print_test_header("Invalid Signal Data")
        
        # First login to get token
        login_data = {
            "email": "admin@mon50cc.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 200:
                self.access_token = response.json()["token"]
                headers = {"Authorization": f"Bearer {self.access_token}"}
                
                # Test with invalid signal type
                invalid_signal = {
                    "lat": 48.8566,
                    "lng": 2.3522,
                    "type": "invalid_type"
                }
                
                response = self.session.post(f"{API_BASE}/signals", json=invalid_signal, headers=headers)
                # This should still work as the backend doesn't validate signal types strictly
                if response.status_code == 200:
                    print_info("Signal with custom type accepted (no strict validation)")
                else:
                    print_info(f"Signal with invalid type rejected: {response.status_code}")
                
                # Test with missing required fields
                incomplete_signal = {
                    "lat": 48.8566,
                    # Missing lng and type
                }
                
                response = self.session.post(f"{API_BASE}/signals", json=incomplete_signal, headers=headers)
                if response.status_code == 422:  # FastAPI validation error
                    print_success("Incomplete signal data correctly rejected")
                else:
                    print_error(f"Expected 422, got {response.status_code}")
                    
        except Exception as e:
            print_error(f"Test failed: {str(e)}")

    def test_vote_on_nonexistent_signal(self):
        """Test voting on non-existent signal"""
        print_test_header("Vote on Non-existent Signal")
        
        if not self.access_token:
            # Login first
            login_data = {
                "email": "admin@mon50cc.com",
                "password": "admin123"
            }
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 200:
                self.access_token = response.json()["token"]
        
        if self.access_token:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            fake_signal_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
            
            vote_data = {"vote_type": "up"}
            
            try:
                response = self.session.post(f"{API_BASE}/signals/{fake_signal_id}/vote", json=vote_data, headers=headers)
                if response.status_code == 404:
                    print_success("Vote on non-existent signal correctly rejected")
                else:
                    print_error(f"Expected 404, got {response.status_code}")
            except Exception as e:
                print_error(f"Test failed: {str(e)}")

    def test_cors_headers(self):
        """Test CORS headers are present"""
        print_test_header("CORS Headers")
        
        try:
            response = self.session.options(f"{API_BASE}/")
            headers = response.headers
            
            cors_headers = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Headers'
            ]
            
            present_headers = [h for h in cors_headers if h in headers]
            
            if len(present_headers) >= 2:  # At least some CORS headers present
                print_success(f"CORS headers present: {present_headers}")
            else:
                print_warning("Limited CORS headers found")
                
        except Exception as e:
            print_error(f"CORS test failed: {str(e)}")

    def test_logout_functionality(self):
        """Test logout functionality"""
        print_test_header("Logout Functionality")
        
        # Login first
        login_data = {
            "email": "admin@mon50cc.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 200:
                print_info("Logged in successfully")
                
                # Test logout
                response = self.session.post(f"{API_BASE}/auth/logout")
                if response.status_code == 200:
                    print_success("Logout successful")
                    
                    # Verify cookies are cleared
                    cookies = dict(self.session.cookies)
                    if 'access_token' not in cookies or not cookies.get('access_token'):
                        print_success("Access token cookie cleared")
                    else:
                        print_warning("Access token cookie still present")
                else:
                    print_error(f"Logout failed: {response.status_code}")
        except Exception as e:
            print_error(f"Logout test failed: {str(e)}")

    def run_all_tests(self):
        """Run all security tests"""
        print(f"{Colors.BOLD}Starting Security and Edge Case Tests{Colors.ENDC}")
        
        self.test_duplicate_registration()
        self.test_invalid_login_credentials()
        self.test_invalid_signal_data()
        self.test_vote_on_nonexistent_signal()
        self.test_cors_headers()
        self.test_logout_functionality()
        
        print(f"\n{Colors.BOLD}Security tests completed{Colors.ENDC}")

if __name__ == "__main__":
    tester = SecurityTester()
    tester.run_all_tests()