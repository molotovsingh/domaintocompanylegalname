const { extractEntityFromDump } = require('./server/beta-v2/processing/fastEntityExtractor');

const testDump = {
  pages: [{
    structuredData: [{
      "@type": "LocalBusiness",
      "name": "Test Company"
    }],
    title: "Test Company Inc. - Official Site",
    metaTags: {
      "og:site_name": "Test Company Inc."
    }
  }]
};

const result = extractEntityFromDump(testDump);
console.log('Fast extraction result:', JSON.stringify(result, null, 2));
