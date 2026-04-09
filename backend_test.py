#!/usr/bin/env python3
"""
Backend API Testing for Mon 50cc et moi
Tests all authentication and signals endpoints
"""

import requests
import json
import time
import sys
from datetime import datetime

# Use the correct backend URL from environment
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

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_result(self, test_name, success, message="", error_details=""):
        if success:
            self.test_results['passed'] += 1
            print_success(f"{test_name}: {message}")
        else:
            self.test_results['failed'] += 1
            error_msg = f"{test_name}: {message}"
            if error_details:
                error_msg += f" - {error_details}"
            self.test_results['errors'].append(error_msg)
            print_error(error_msg)

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print_test_header("Health Check Endpoints")
        
        # Test root endpoint
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "running":
                    self.log_result("GET /api/", True, "Root endpoint working")
                else:
                    self.log_result("GET /api/", False, f"Unexpected response: {data}")
            else:
                self.log_result("GET /api/", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/", False, f"Request failed: {str(e)}")

        # Test health endpoint
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("GET /api/health", True, "Health endpoint working")
                else:
                    self.log_result("GET /api/health", False, f"Unexpected response: {data}")
            else:
                self.log_result("GET /api/health", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/health", False, f"Request failed: {str(e)}")

    def test_auth_register(self):
        """Test user registration"""
        print_test_header("User Registration")
        
        # Generate unique email for testing
        timestamp = int(time.time())
        test_email = f"test{timestamp}@test.com"
        
        register_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test User"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "email", "name", "token"]
                if all(field in data for field in required_fields):
                    self.access_token = data["token"]
                    self.user_id = data["id"]
                    self.log_result("POST /api/auth/register", True, f"User registered successfully: {data['email']}")
                    
                    # Check if httpOnly cookies are set
                    cookies = response.cookies
                    if 'access_token' in cookies:
                        print_info("HttpOnly access_token cookie set")
                    else:
                        print_warning("HttpOnly access_token cookie not found")
                        
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_result("POST /api/auth/register", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("POST /api/auth/register", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/auth/register", False, f"Request failed: {str(e)}")

    def test_auth_login(self):
        """Test user login with admin credentials"""
        print_test_header("User Login")
        
        login_data = {
            "email": "admin@mon50cc.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "email", "name", "token"]
                if all(field in data for field in required_fields):
                    self.access_token = data["token"]
                    self.user_id = data["id"]
                    self.log_result("POST /api/auth/login", True, f"Login successful: {data['email']}")
                    
                    # Check if httpOnly cookies are set
                    cookies = response.cookies
                    if 'access_token' in cookies:
                        print_info("HttpOnly access_token cookie set")
                    else:
                        print_warning("HttpOnly access_token cookie not found")
                        
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_result("POST /api/auth/login", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("POST /api/auth/login", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/auth/login", False, f"Request failed: {str(e)}")

    def test_auth_me(self):
        """Test getting current user info"""
        print_test_header("Get Current User")
        
        if not self.access_token:
            self.log_result("GET /api/auth/me", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["_id", "email", "name"]
                if all(field in data for field in required_fields):
                    self.log_result("GET /api/auth/me", True, f"User info retrieved: {data['email']}")
                    # Ensure password is not returned
                    if "password_hash" in data or "password" in data:
                        print_warning("Password hash found in response - security issue")
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_result("GET /api/auth/me", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("GET /api/auth/me", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/auth/me", False, f"Request failed: {str(e)}")

    def test_signals_get(self):
        """Test getting all signals"""
        print_test_header("Get All Signals")
        
        try:
            response = self.session.get(f"{API_BASE}/signals")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("GET /api/signals", True, f"Retrieved {len(data)} signals")
                    
                    # Check signal structure if any signals exist
                    if data:
                        signal = data[0]
                        required_fields = ["id", "lat", "lng", "type", "upvotes", "downvotes", "user_id", "created_at"]
                        if all(field in signal for field in required_fields):
                            print_info("Signal structure is correct")
                        else:
                            missing_fields = [f for f in required_fields if f not in signal]
                            print_warning(f"Signal missing fields: {missing_fields}")
                else:
                    self.log_result("GET /api/signals", False, f"Expected list, got: {type(data)}")
            else:
                self.log_result("GET /api/signals", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/signals", False, f"Request failed: {str(e)}")

    def test_signals_create(self):
        """Test creating a signal"""
        print_test_header("Create Signal")
        
        if not self.access_token:
            self.log_result("POST /api/signals", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        signal_data = {
            "lat": 48.8566,
            "lng": 2.3522,
            "type": "police"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/signals", json=signal_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "lat", "lng", "type", "upvotes", "downvotes", "user_id", "created_at"]
                if all(field in data for field in required_fields):
                    self.signal_id = data["id"]  # Store for voting test
                    self.log_result("POST /api/signals", True, f"Signal created: {data['type']} at ({data['lat']}, {data['lng']})")
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_result("POST /api/signals", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("POST /api/signals", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/signals", False, f"Request failed: {str(e)}")

    def test_anti_spam(self):
        """Test anti-spam protection"""
        print_test_header("Anti-Spam Protection")
        
        if not self.access_token:
            self.log_result("Anti-spam test", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        signal_data = {
            "lat": 48.8566,
            "lng": 2.3522,
            "type": "danger"
        }
        
        try:
            # Try to create another signal immediately
            response = self.session.post(f"{API_BASE}/signals", json=signal_data, headers=headers)
            if response.status_code == 429:
                self.log_result("Anti-spam protection", True, "Correctly blocked rapid signal creation")
            elif response.status_code == 200:
                self.log_result("Anti-spam protection", False, "Anti-spam not working - signal created too quickly")
            else:
                self.log_result("Anti-spam protection", False, f"Unexpected status code: {response.status_code}")
        except Exception as e:
            self.log_result("Anti-spam protection", False, f"Request failed: {str(e)}")

    def test_signals_vote(self):
        """Test voting on a signal"""
        print_test_header("Vote on Signal")
        
        if not self.access_token:
            self.log_result("POST /api/signals/{id}/vote", False, "No access token available")
            return
        
        if not hasattr(self, 'signal_id'):
            # Create a signal first for voting
            self.test_signals_create()
            if not hasattr(self, 'signal_id'):
                self.log_result("POST /api/signals/{id}/vote", False, "No signal available for voting")
                return
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        vote_data = {"vote_type": "up"}
        
        try:
            response = self.session.post(f"{API_BASE}/signals/{self.signal_id}/vote", json=vote_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get("upvotes", 0) > 0:
                    self.log_result("POST /api/signals/{id}/vote", True, f"Vote successful - upvotes: {data['upvotes']}")
                else:
                    self.log_result("POST /api/signals/{id}/vote", False, "Vote not reflected in response")
            else:
                self.log_result("POST /api/signals/{id}/vote", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/signals/{id}/vote", False, f"Request failed: {str(e)}")

    def test_duplicate_vote(self):
        """Test that duplicate voting is prevented"""
        print_test_header("Duplicate Vote Prevention")
        
        if not self.access_token or not hasattr(self, 'signal_id'):
            self.log_result("Duplicate vote prevention", False, "Prerequisites not met")
            return
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        vote_data = {"vote_type": "up"}
        
        try:
            # Try to vote again on the same signal
            response = self.session.post(f"{API_BASE}/signals/{self.signal_id}/vote", json=vote_data, headers=headers)
            if response.status_code == 400:
                self.log_result("Duplicate vote prevention", True, "Correctly prevented duplicate voting")
            else:
                self.log_result("Duplicate vote prevention", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Duplicate vote prevention", False, f"Request failed: {str(e)}")

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        print_test_header("Unauthorized Access Protection")
        
        # Test creating signal without token - use fresh session
        signal_data = {
            "lat": 48.8566,
            "lng": 2.3522,
            "type": "police"
        }
        
        try:
            fresh_session = requests.Session()
            response = fresh_session.post(f"{API_BASE}/signals", json=signal_data)
            if response.status_code == 401:
                self.log_result("Unauthorized signal creation", True, "Correctly blocked unauthorized access")
            else:
                self.log_result("Unauthorized signal creation", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Unauthorized signal creation", False, f"Request failed: {str(e)}")

        # Test getting user info without token - use fresh session
        try:
            fresh_session = requests.Session()
            response = fresh_session.get(f"{API_BASE}/auth/me")
            if response.status_code == 401:
                self.log_result("Unauthorized user info", True, "Correctly blocked unauthorized access")
            else:
                self.log_result("Unauthorized user info", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Unauthorized user info", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"{Colors.BOLD}Starting Mon 50cc et moi API Tests{Colors.ENDC}")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        
        # Health checks first
        self.test_health_endpoints()
        
        # Authentication tests
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_me()
        
        # Signals tests
        self.test_signals_get()
        self.test_signals_create()
        self.test_anti_spam()
        self.test_signals_vote()
        self.test_duplicate_vote()
        
        # Security tests
        self.test_unauthorized_access()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.ENDC}")
        total_tests = self.test_results['passed'] + self.test_results['failed']
        print(f"Total Tests: {total_tests}")
        print_success(f"Passed: {self.test_results['passed']}")
        
        if self.test_results['failed'] > 0:
            print_error(f"Failed: {self.test_results['failed']}")
            print(f"\n{Colors.RED}Failed Tests:{Colors.ENDC}")
            for error in self.test_results['errors']:
                print(f"  - {error}")
        else:
            print_success("All tests passed!")
        
        # Return exit code
        return 0 if self.test_results['failed'] == 0 else 1

if __name__ == "__main__":
    tester = APITester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)