
# Utility Scripts

*Created: July 12, 2025 at 2:52 AM UTC*

This folder contains standalone scripts for testing, debugging, and maintenance of the Domain Intelligence Platform.

## Testing Scripts

### **Extraction Testing**
- **`test_geographic_extraction.js`** - Geographic domain extraction validation
- **`extract_footer.js`** - Footer-based company name extraction testing
- **`extract_exxon_footer.js`** - Specific case study for Exxon domain

### **GLEIF Integration Testing**
- **`test_gleif_connection.js`** - Basic GLEIF API connectivity
- **`test_gleif_validation.js`** - Entity validation accuracy testing
- **`test_gleif_debug.js`** - Detailed debugging for GLEIF issues
- **`test_wildenstein_gleif.js`** - Specific case validation

### **System Integration**
- **`test_fastapi_integration.py`** - FastAPI analytics server testing
- **`test-beta-server.js`** - Beta server functionality validation

## Maintenance Scripts

### **Recovery & Operations**
- **`restart-stuck-batch.js`** - Automated recovery for stalled batch processing
  - Identifies domains stuck in processing state
  - Clears stuck domains back to pending
  - Restarts batch processing automatically

### **Server Management**
- **`start-beta-server.sh`** - Beta server startup with error handling
- **`test-beta-server.js`** - Beta server health checks

## Usage Guidelines

### **Running Scripts**
Most scripts can be executed directly from the project root:
```bash
node scripts/script-name.js
```

For Python scripts:
```bash
python scripts/script-name.py
```

### **Environment Requirements**
- Scripts assume access to production database
- Some require GLEIF API credentials
- Beta testing scripts need beta database access

### **Safety Considerations**
- **`restart-stuck-batch.js`** modifies database state
- Always test on non-production data first
- Review script parameters before execution
- Monitor logs during script execution

## Script Categories

### **Diagnostic Scripts**
Test connectivity, validate configurations, debug issues

### **Recovery Scripts**
Automated fixes for common operational problems

### **Research Scripts**
Exploratory testing for new features and methods

### **Validation Scripts**
Accuracy and performance verification tools

## Integration with Services

Scripts complement the main application services:
- Use same database connections (`server/db.ts`)
- Share storage interfaces (`server/storage.ts`)
- Leverage existing service modules
- Follow same error handling patterns

## Development Notes

When creating new scripts:
1. Add descriptive comments explaining purpose
2. Include error handling and logging
3. Document required parameters
4. Test thoroughly before committing
5. Update this README with script description
