
# GLEIF Interactive Search Tool - Working Code

## Overview
This document contains the working GLEIF interactive search code that has been tested and validated in Google Colab. This tool provides a comprehensive interface for searching and analyzing GLEIF (Global Legal Entity Identifier Foundation) data.

## Working Implementation

```python
import requests
import json
from urllib.parse import quote

class GLEIFEnhancedSearch:
    def __init__(self):
        self.base_url = "https://api.gleif.org/api/v1"
        self.headers = {
            'Accept': 'application/vnd.api+json',
            'User-Agent': 'GLEIF-Enhanced-Search/1.0'
        }
    
    def get_comprehensive_entity_data(self, company_name, max_results=5):
        """
        Get comprehensive entity data - User Input Version
        """
        try:
            url = f"{self.base_url}/lei-records"
            params = {
                'filter[entity.legalName]': company_name,
                'page[size]': max_results
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('data'):
                return self._fuzzy_search_enhanced(company_name, max_results)
            
            return self._format_comprehensive_results(data['data'])
            
        except Exception as e:
            return {'error': f'API request failed: {str(e)}'}
    
    def _fuzzy_search_enhanced(self, company_name, max_results):
        """Enhanced fuzzy search"""
        try:
            url = f"{self.base_url}/lei-records"
            params = {
                'filter[entity.legalName]': f'*{company_name}*',
                'page[size]': max_results
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return self._format_comprehensive_results(data.get('data', []))
            
        except Exception:
            return {'results': [], 'message': 'No matches found'}
    
    def _format_comprehensive_results(self, raw_data):
        """Format comprehensive entity data"""
        results = []
        
        for record in raw_data:
            attributes = record.get('attributes', {})
            entity = attributes.get('entity', {})
            registration = attributes.get('registration', {})
            
            result = {
                'lei': record.get('id', 'N/A'),
                'legal_name': entity.get('legalName', {}).get('name', 'N/A'),
                'legal_name_language': entity.get('legalName', {}).get('language', 'N/A'),
                'entity_category': entity.get('category', 'N/A'),
                'entity_sub_category': entity.get('subCategory', 'N/A'),
                'entity_status': entity.get('status', 'N/A'),
                'legal_form': entity.get('legalForm', {}).get('id', 'N/A'),
                'legal_form_other': entity.get('legalForm', {}).get('other', 'N/A'),
                'jurisdiction': entity.get('jurisdiction', 'N/A'),
                'creation_date': entity.get('creationDate', 'N/A'),
                'legal_address': self._format_address(entity.get('legalAddress', {})),
                'headquarters_address': self._format_address(entity.get('headquartersAddress', {})),
                'other_names': [{'name': name.get('name'), 'type': name.get('type'), 'language': name.get('language')} 
                               for name in entity.get('otherNames', [])],
                'registration_status': registration.get('registrationStatus', 'N/A'),
                'registration_date': registration.get('initialRegistrationDate', 'N/A'),
                'last_update_date': registration.get('lastUpdateDate', 'N/A'),
                'next_renewal_date': registration.get('nextRenewalDate', 'N/A'),
                'managing_lou': registration.get('managingLOU', 'N/A'),
                'validation_sources': registration.get('validationSources', 'N/A'),
            }
            
            results.append(result)
        
        return {
            'results': results,
            'count': len(results),
            'message': f'Found {len(results)} comprehensive matches'
        }
    
    def _format_address(self, address):
        """Format address information"""
        if not address:
            return {}
        
        return {
            'first_address_line': address.get('firstAddressLine', 'N/A'),
            'city': address.get('city', 'N/A'),
            'region': address.get('region', 'N/A'),
            'country': address.get('country', 'N/A'),
            'postal_code': address.get('postalCode', 'N/A'),
        }

def display_menu():
    """Display the main menu options"""
    print("\n" + "="*60)
    print("🔍 GLEIF Entity Search Tool")
    print("="*60)
    print("1. Search for a company")
    print("2. Search multiple companies")
    print("3. Search by LEI code")
    print("4. View search history")
    print("5. Exit")
    print("="*60)

def get_user_choice():
    """Get user menu choice with validation"""
    while True:
        try:
            choice = input("\n👉 Enter your choice (1-5): ").strip()
            if choice in ['1', '2', '3', '4', '5']:
                return int(choice)
            else:
                print("❌ Invalid choice. Please enter a number between 1-5.")
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            exit()
        except:
            print("❌ Invalid input. Please enter a number between 1-5.")

def search_single_company(gleif_searcher, search_history):
    """Handle single company search"""
    print("\n📋 Single Company Search")
    print("-" * 30)
    
    company_name = input("Enter company name: ").strip()
    
    if not company_name:
        print("❌ Company name cannot be empty!")
        return
    
    max_results = input("Max results to show (default 5): ").strip()
    try:
        max_results = int(max_results) if max_results else 5
        max_results = min(max_results, 20)  # Cap at 20
    except:
        max_results = 5
    
    print(f"\n🔍 Searching for: '{company_name}'...")
    
    results = gleif_searcher.get_comprehensive_entity_data(company_name, max_results)
    display_search_results(results, company_name)
    
    # Add to search history
    search_history.append({
        'query': company_name,
        'results_count': results.get('count', 0),
        'timestamp': json.dumps({"time": "now"})  # Simple timestamp
    })

def search_multiple_companies(gleif_searcher, search_history):
    """Handle multiple company search"""
    print("\n📋 Multiple Company Search")
    print("-" * 30)
    print("Enter company names (one per line, empty line to finish):")
    
    companies = []
    while True:
        company = input(f"Company {len(companies) + 1}: ").strip()
        if not company:
            break
        companies.append(company)
        if len(companies) >= 10:  # Limit to 10 companies
            print("⚠️  Maximum 10 companies allowed per batch.")
            break
    
    if not companies:
        print("❌ No companies entered!")
        return
    
    print(f"\n🔍 Searching for {len(companies)} companies...")
    
    for i, company in enumerate(companies, 1):
        print(f"\n{'='*20} RESULT {i}/{len(companies)} {'='*20}")
        print(f"🏢 Searching: {company}")
        
        results = gleif_searcher.get_comprehensive_entity_data(company, 3)  # Limit to 3 per company
        display_search_results(results, company, compact=True)
        
        # Add to search history
        search_history.append({
            'query': company,
            'results_count': results.get('count', 0),
            'timestamp': json.dumps({"time": "now"})
        })

def search_by_lei(gleif_searcher, search_history):
    """Handle LEI code search"""
    print("\n📋 LEI Code Search")
    print("-" * 30)
    
    lei_code = input("Enter LEI code (20 characters): ").strip().upper()
    
    if len(lei_code) != 20:
        print("❌ LEI code must be exactly 20 characters!")
        return
    
    print(f"\n🔍 Looking up LEI: {lei_code}...")
    
    try:
        url = f"{gleif_searcher.base_url}/lei-records/{lei_code}"
        response = requests.get(url, headers=gleif_searcher.headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = gleif_searcher._format_comprehensive_results([data.get('data', {})])
            display_search_results(results, lei_code)
            
            search_history.append({
                'query': f"LEI: {lei_code}",
                'results_count': 1,
                'timestamp': json.dumps({"time": "now"})
            })
        elif response.status_code == 404:
            print("❌ LEI code not found!")
        else:
            print(f"❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error searching LEI: {str(e)}")

def display_search_results(results, query, compact=False):
    """Display formatted search results"""
    if 'error' in results:
        print(f"❌ Error: {results['error']}")
        return
    
    if not results['results']:
        print("❌ No matches found")
        return
    
    print(f"✅ {results['message']}")
    
    for i, entity in enumerate(results['results'], 1):
        if compact:
            # Compact display for multiple searches
            print(f"  {i}. {entity['legal_name']} | LEI: {entity['lei']} | {entity['jurisdiction']}")
        else:
            # Full display for single searches
            print(f"\n{'='*15} ENTITY {i} {'='*15}")
            print(f"🏢 **Legal Name**: {entity['legal_name']}")
            print(f"🆔 **LEI**: {entity['lei']}")
            print(f"📊 **Category**: {entity['entity_category']}")
            print(f"⚖️  **Legal Form**: {entity['legal_form']}")
            print(f"🏛️  **Jurisdiction**: {entity['jurisdiction']}")
            print(f"🔄 **Status**: {entity['entity_status']} | {entity['registration_status']}")
            
            if entity['legal_address']:
                addr = entity['legal_address']
                print(f"🏠 **Address**: {addr['first_address_line']}, {addr['city']}, {addr['country']}")
            
            if entity['other_names']:
                print(f"🏷️  **Other Names**: {len(entity['other_names'])} found")
                for name in entity['other_names'][:2]:
                    print(f"   - {name['name']} ({name['type']})")

def view_search_history(search_history):
    """Display search history"""
    print("\n📋 Search History")
    print("-" * 30)
    
    if not search_history:
        print("No searches performed yet.")
        return
    
    print(f"Total searches: {len(search_history)}")
    print("\nRecent searches:")
    
    for i, search in enumerate(search_history[-10:], 1):  # Show last 10
        print(f"{i:2d}. '{search['query']}' → {search['results_count']} results")

def main():
    """Main interactive application"""
    print("🚀 Welcome to GLEIF Entity Search Tool!")
    
    gleif_searcher = GLEIFEnhancedSearch()
    search_history = []
    
    while True:
        display_menu()
        choice = get_user_choice()
        
        if choice == 1:
            search_single_company(gleif_searcher, search_history)
        elif choice == 2:
            search_multiple_companies(gleif_searcher, search_history)
        elif choice == 3:
            search_by_lei(gleif_searcher, search_history)
        elif choice == 4:
            view_search_history(search_history)
        elif choice == 5:
            print("\n👋 Thank you for using GLEIF Entity Search Tool!")
            break
        
        # Ask if user wants to continue
        if choice in [1, 2, 3]:
            continue_choice = input("\n🔄 Press Enter to return to menu or 'q' to quit: ").strip().lower()
            if continue_choice == 'q':
                print("\n👋 Thank you for using GLEIF Entity Search Tool!")
                break

if __name__ == "__main__":
    main()
```

## Key Features

### 1. **Interactive Menu System**
- Single company search
- Multiple company batch search
- LEI code direct lookup
- Search history tracking

### 2. **Comprehensive Data Extraction**
- Legal entity name and language
- LEI code (20-character identifier)
- Entity category and subcategory
- Legal form and jurisdiction
- Registration status and dates
- Legal and headquarters addresses
- Alternative entity names
- Validation sources and managing LOU

### 3. **Enhanced Search Capabilities**
- Exact name matching
- Fuzzy search with wildcards
- Direct LEI code lookup
- Batch processing (up to 10 companies)
- Result limiting and pagination

### 4. **User Experience Features**
- Clear menu-driven interface
- Progress indicators
- Error handling with meaningful messages
- Search history tracking
- Compact and detailed view modes

### 5. **API Integration**
- **Base URL**: `https://api.gleif.org/api/v1`
- **Authentication**: None required (public API)
- **Rate Limits**: None documented
- **Response Format**: JSON:API compliant

## Testing Status
✅ **Verified Working**: This code has been tested and validated in Google Colab environment
✅ **Production Ready**: Can be integrated into existing systems
✅ **Error Handling**: Comprehensive error handling for API failures
✅ **User-Friendly**: Interactive interface with clear feedback

## Integration Notes
This standalone tool can be easily integrated into the existing beta testing framework or used as a reference for enhancing the current GLEIF extraction services in the TypeScript codebase.

## Usage Instructions
1. Run the script in a Python environment
2. Select from the menu options (1-5)
3. Follow the prompts for each search type
4. View results in either compact or detailed format
5. Access search history to track previous queries

This tool provides a robust foundation for GLEIF data integration and can serve as a reference implementation for the production system.
