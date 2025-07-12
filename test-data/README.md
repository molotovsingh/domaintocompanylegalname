
# Test Data - Domain Processing Validation Sets

*Last Updated: July 12, 2025 at 2:52 AM UTC*

## Purpose
This folder contains curated test datasets used for validating domain extraction methods, testing business intelligence classification, and ensuring quality across different extraction scenarios and geographic regions.

## Test Dataset Categories

### **Domain Extraction Validation**
Core test files for validating extraction accuracy and method effectiveness:

- **`test_validation.txt`** - Primary validation set with known company names
- **`test_confidence_validation.txt`** - Confidence scoring accuracy testing
- **`test_domain_mapping_validation.txt`** - Domain-to-entity mapping verification
- **`test_enhanced_extraction.txt`** - Advanced extraction method testing
- **`test_enhanced_expected_names.txt`** - Expected results for validation

### **Geographic & Jurisdictional Testing**
Region-specific test sets for global domain intelligence validation:

#### European Union
- **`test_irish_companies.txt`** - Irish companies with proper suffixes (.ie domains)
- **`test_additional_irish.txt`** - Extended Irish company validation
- **`test_irish_private_companies.txt`** - Irish private limited companies

#### BRICS Markets
- **`test_brazilian_companies.txt`** - Brazilian Limitada and S.A. entities
- **`test_comprehensive_brazilian.txt`** - Extended Brazilian market validation
- **`test_chinese_companies.txt`** - Chinese corporations and state enterprises
- **`test_russian_validation.txt`** - Russian federation entity testing

### **GLEIF Integration Testing**
Legal Entity Identifier validation and integration testing:

- **`test_authentic_gleif.txt`** - Verified GLEIF entities for accuracy testing
- **`test_nissan_validation.txt`** - Complex multinational entity validation
- **`test_secured.txt`** - Financial services entity validation

### **Business Intelligence Classification**
Specialized test sets for business classification and intelligence:

- **`test_suffix_validation.txt`** - Corporate suffix accuracy testing
- **`test_modern.txt`** - Modern technology companies
- **`test_solicitor.txt`** - Professional services validation
- **`test_single_natura.txt`** - Single entity deep validation

### **Quality Assurance & Edge Cases**
Special test cases for quality assurance and edge case handling:

- **`duplication_test.txt`** - Duplicate domain detection testing
- **`test_working.txt`** - Active domain validation set
- **`test_refresh.csv`** - Refresh testing for stale data

### **CSV Format Test Sets**
Structured test data in CSV format for batch processing validation:

- **`test_geo.csv`** - Geographic distribution testing
- **`test_manus.csv`** - Manufacturing sector entities
- **`test_multiple.csv`** - Multi-domain batch testing

### **Content Analysis Samples**
Detailed content analysis for extraction method development:

- **`merck_content_analysis.md`** - Pharmaceutical company content analysis
- **`test_mimitoys.txt`** - Toy industry extraction challenges

## Test Data Characteristics

### **Domain Coverage**
- **120+ Countries**: Global geographic representation
- **15+ Industries**: Technology, Financial, Healthcare, Manufacturing, etc.
- **50+ Entity Types**: Corporation, Limited, GmbH, S.A., Pvt Ltd, etc.
- **Multiple TLDs**: .com, .de, .fr, .ie, .cn, .br, .in, country-specific

### **Extraction Complexity Levels**
- **Level 1**: Simple domain parsing (domain.tld → Domain)
- **Level 2**: HTML meta tag extraction
- **Level 3**: JavaScript-rendered content extraction
- **Level 4**: Complex footer/header analysis
- **Level 5**: AI-powered content interpretation

### **Validation Standards**
- **Known Results**: Pre-verified company names and suffixes
- **Confidence Scoring**: Expected confidence levels (60-95%)
- **Method Attribution**: Expected extraction method for each domain
- **Geographic Context**: Country detection and jurisdiction validation

## Usage Guidelines

### **Running Validation Tests**
```bash
# Single domain testing
npm run test:domain -- test-data/test_validation.txt

# Batch validation testing
npm run test:batch -- test-data/test_multiple.csv

# GLEIF integration testing
npm run test:gleif -- test-data/test_authentic_gleif.txt
```

### **Adding New Test Data**
When adding new test domains:
1. **Verify Results**: Manually validate expected company names
2. **Document Expectations**: Include expected extraction method and confidence
3. **Geographic Distribution**: Ensure balanced geographic representation
4. **Industry Coverage**: Include diverse industry categories
5. **Complexity Levels**: Test various extraction difficulty levels

### **Test Data Format Standards**
```
# Single domain per line format
domain.com

# CSV format with expected results
domain,expected_company,expected_confidence,expected_method
example.com,Example Corp,85,meta_extraction
```

## Quality Assurance Integration

### **Automated Testing**
- **Smoke Tests**: Daily validation using core test sets
- **Regression Testing**: Ensure new changes don't break existing functionality
- **Performance Benchmarking**: Track extraction speed and accuracy over time
- **Geographic Validation**: Ensure global extraction accuracy

### **Manual Validation**
- **Expert Review**: Legal entity specialists validate complex cases
- **Cultural Context**: Local experts verify region-specific naming conventions
- **Industry Expertise**: Sector specialists validate industry-specific patterns
- **Legal Compliance**: Ensure entity name extraction meets regulatory standards

## Test Result Analysis

### **Success Metrics**
- **Extraction Accuracy**: Percentage of correctly identified company names
- **Confidence Correlation**: Accuracy correlation with confidence scores
- **Method Effectiveness**: Performance comparison across extraction methods
- **Geographic Performance**: Accuracy by country and region

### **Failure Analysis**
- **Common Failure Patterns**: Systematic extraction challenges
- **Geographic Blind Spots**: Regions requiring specialized handling
- **Industry Challenges**: Sectors with unique naming conventions
- **Technical Limitations**: Platform or method-specific constraints

## Compliance & Privacy

### **Data Sources**
- **Public Information**: Only publicly accessible domain information
- **No Personal Data**: Corporate entities only, no individual information
- **Regulatory Compliance**: Respects GDPR, CCPA, and other data protection laws
- **Ethical Usage**: Business intelligence purposes only

### **Data Retention**
- **Test Purpose Only**: Data used exclusively for validation and testing
- **No Commercial Use**: Not used for competitive intelligence or sales
- **Regular Updates**: Periodic refresh to ensure current accuracy
- **Anonymization**: No tracking of individual domain owners

## Development Integration

### **CI/CD Integration**
Test data is integrated into the continuous integration pipeline:
- **Pre-commit Validation**: Quick smoke test before code commits
- **Pull Request Testing**: Comprehensive validation for code changes
- **Deployment Validation**: Post-deployment accuracy verification
- **Performance Monitoring**: Ongoing accuracy and speed monitoring

### **Beta Testing Support**
Test data supports beta feature development:
- **Isolated Testing**: Beta server uses dedicated test datasets
- **Method Comparison**: A/B testing new extraction approaches
- **Safety Validation**: Ensure experimental features don't degrade accuracy
- **Performance Optimization**: Benchmark new implementations

This comprehensive test data collection ensures the Domain Intelligence Platform maintains high accuracy across global markets while supporting continuous improvement and feature development.
